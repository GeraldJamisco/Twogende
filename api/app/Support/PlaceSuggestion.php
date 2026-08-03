<?php

namespace App\Support;

/**
 * One row in the autocomplete dropdown. Carries no coordinates those cost a
 * separate billed lookup, made only once the user picks something.
 */
final readonly class PlaceSuggestion
{
    public function __construct(
        public string $placeId,
        /** Bold line, e.g. "Ntinda". */
        public string $primaryText,
        /** Grey line, e.g. "Kampala, Uganda". */
        public string $secondaryText,
    ) {}

    /**
     * @return array<string, string>
     */
    public function toArray(): array
    {
        return [
            'place_id' => $this->placeId,
            'primary_text' => $this->primaryText,
            'secondary_text' => $this->secondaryText,
        ];
    }
}
