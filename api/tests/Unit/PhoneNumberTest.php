<?php

namespace Tests\Unit;

use App\Support\PhoneNumber;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PhoneNumberTest extends TestCase
{
    /**
     * @return array<string, array{string}>
     */
    public static function equivalentSpellings(): array
    {
        return [
            'national with trunk zero' => ['0701234567'],
            'national without trunk zero' => ['701234567'],
            'country code, no plus' => ['256701234567'],
            'full E.164' => ['+256701234567'],
            'spaced' => ['0701 234 567'],
            'dashed' => ['0701-234-567'],
            'international dialling prefix' => ['00256701234567'],
            'surrounding whitespace' => ['  +256 701 234 567  '],
        ];
    }

    #[DataProvider('equivalentSpellings')]
    public function test_every_spelling_of_a_number_collapses_to_one_string(string $input): void
    {
        $this->assertSame('+256701234567', PhoneNumber::normalise($input));
    }

    /**
     * @return array<string, array{?string}>
     */
    public static function invalidNumbers(): array
    {
        return [
            'too short' => ['070123456'],
            'too long' => ['07012345678'],
            'landline range' => ['0414234567'],
            'not a number' => ['not-a-phone'],
            'empty' => [''],
            'null' => [null],
            'another country' => ['+254701234567'],
        ];
    }

    #[DataProvider('invalidNumbers')]
    public function test_numbers_that_are_not_ugandan_mobiles_are_rejected(?string $input): void
    {
        $this->assertNull(PhoneNumber::normalise($input));
        $this->assertFalse(PhoneNumber::isValid($input));
    }

    public function test_numbers_are_displayed_the_way_ugandans_write_them(): void
    {
        $this->assertSame('0701 234 567', PhoneNumber::forDisplay('+256701234567'));
    }

    public function test_masking_hides_the_middle_of_the_number(): void
    {
        $masked = PhoneNumber::masked('+256701234567');

        $this->assertStringStartsWith('+256701', $masked);
        $this->assertStringEndsWith('67', $masked);
        $this->assertStringNotContainsString('2345', $masked);
    }
}
