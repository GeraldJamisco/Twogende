<?php

namespace App\Support;

use App\Enums\RatedRole;
use App\Enums\RatingCategory;
use App\Models\Rating;
use App\Models\User;
use Illuminate\Support\Arr;

/**
 * The vocabulary of quick tags offered under the stars, and what they add up to.
 *
 * Ratings store the *slug*, never the label. A stored label would mean every
 * wording change silently split one attribute into two, and the percentages on
 * a profile would quietly stop being true. Labels are presentation; slugs are
 * the record.
 *
 * Each tag declares:
 *  - the category it counts towards ("Driving"),
 *  - whether it is praise or a complaint, which is what makes a percentage
 *    possible at all,
 *  - which side of the ride it can be said about. "Clean car" is meaningless
 *    about a passenger; "No-show" is meaningless about a driver who turned up
 *    and drove.
 */
final class RatingTags
{
    private const DRIVER = 'driver';

    private const PASSENGER = 'passenger';

    private const BOTH = 'both';

    /**
     * `rank` is display order within one valence - the screen shows the first
     * six chips and hides the rest behind "More", so the six that matter most
     * have to be the six that come first. Chosen by hand for now; once there
     * is real usage it should be driven by what people actually tap.
     *
     * @var array<string, array{rank: int, label: string, category: RatingCategory, positive: bool, about: string}>
     */
    private const CATALOGUE = [
        // 🚗 Driving - only ever said about the person behind the wheel.
        'smooth_driving' => ['rank' => 1, 'label' => 'Smooth driving', 'category' => RatingCategory::Driving, 'positive' => true, 'about' => self::DRIVER],
        'safe_driving' => ['rank' => 5, 'label' => 'Safe driving', 'category' => RatingCategory::Driving, 'positive' => true, 'about' => self::DRIVER],
        'aggressive_driving' => ['rank' => 5, 'label' => 'Aggressive driving', 'category' => RatingCategory::Driving, 'positive' => false, 'about' => self::DRIVER],
        'reckless_driving' => ['rank' => 7, 'label' => 'Reckless driving', 'category' => RatingCategory::Driving, 'positive' => false, 'about' => self::DRIVER],
        'uncomfortable_driving' => ['rank' => 12, 'label' => 'Uncomfortable driving', 'category' => RatingCategory::Driving, 'positive' => false, 'about' => self::DRIVER],

        // ⏰ Reliability - both sides can be late, both can honour the plan.
        'on_time' => ['rank' => 2, 'label' => 'On time', 'category' => RatingCategory::Reliability, 'positive' => true, 'about' => self::BOTH],
        'pickup_respected' => ['rank' => 13, 'label' => 'Pickup arrangement was respected', 'category' => RatingCategory::Reliability, 'positive' => true, 'about' => self::BOTH],
        'late_pickup' => ['rank' => 1, 'label' => 'Late pickup', 'category' => RatingCategory::Reliability, 'positive' => false, 'about' => self::BOTH],
        'very_late' => ['rank' => 8, 'label' => 'Very late', 'category' => RatingCategory::Reliability, 'positive' => false, 'about' => self::BOTH],
        'no_show' => ['rank' => 9, 'label' => 'No-show', 'category' => RatingCategory::Reliability, 'positive' => false, 'about' => self::BOTH],

        // 💬 Communication
        'good_communication' => ['rank' => 6, 'label' => 'Good communication', 'category' => RatingCategory::Communication, 'positive' => true, 'about' => self::BOTH],
        'easy_to_coordinate' => ['rank' => 11, 'label' => 'Easy to coordinate with', 'category' => RatingCategory::Communication, 'positive' => true, 'about' => self::BOTH],
        'difficult_to_reach' => ['rank' => 10, 'label' => 'Difficult to reach', 'category' => RatingCategory::Communication, 'positive' => false, 'about' => self::BOTH],
        'poor_communication' => ['rank' => 4, 'label' => 'Poor communication', 'category' => RatingCategory::Communication, 'positive' => false, 'about' => self::BOTH],

        // 🧼 Vehicle - the car is the driver's.
        'clean_car' => ['rank' => 3, 'label' => 'Clean car', 'category' => RatingCategory::Vehicle, 'positive' => true, 'about' => self::DRIVER],
        'comfortable_ride' => ['rank' => 7, 'label' => 'Comfortable ride', 'category' => RatingCategory::Vehicle, 'positive' => true, 'about' => self::DRIVER],
        'unclean_car' => ['rank' => 2, 'label' => 'Unclean car', 'category' => RatingCategory::Vehicle, 'positive' => false, 'about' => self::DRIVER],
        'uncomfortable_ride' => ['rank' => 6, 'label' => 'Uncomfortable ride', 'category' => RatingCategory::Vehicle, 'positive' => false, 'about' => self::DRIVER],

        // 🤝 Behaviour
        'friendly' => ['rank' => 4, 'label' => 'Friendly', 'category' => RatingCategory::Behaviour, 'positive' => true, 'about' => self::BOTH],
        'respectful' => ['rank' => 8, 'label' => 'Respectful', 'category' => RatingCategory::Behaviour, 'positive' => true, 'about' => self::BOTH],
        'great_conversation' => ['rank' => 9, 'label' => 'Great conversation', 'category' => RatingCategory::Behaviour, 'positive' => true, 'about' => self::BOTH],
        'professional' => ['rank' => 10, 'label' => 'Professional', 'category' => RatingCategory::Behaviour, 'positive' => true, 'about' => self::BOTH],
        'rude' => ['rank' => 11, 'label' => 'Rude', 'category' => RatingCategory::Behaviour, 'positive' => false, 'about' => self::BOTH],

        // 📍 Trip accuracy - about the ride the driver published and drove.
        'accurate_trip_details' => ['rank' => 14, 'label' => 'Accurate trip details', 'category' => RatingCategory::TripAccuracy, 'positive' => true, 'about' => self::DRIVER],
        'good_route_knowledge' => ['rank' => 15, 'label' => 'Good route knowledge', 'category' => RatingCategory::TripAccuracy, 'positive' => true, 'about' => self::DRIVER],
        'route_issue' => ['rank' => 3, 'label' => 'Route issue', 'category' => RatingCategory::TripAccuracy, 'positive' => false, 'about' => self::DRIVER],
        'unexpected_route_change' => ['rank' => 13, 'label' => 'Unexpected route change', 'category' => RatingCategory::TripAccuracy, 'positive' => false, 'about' => self::DRIVER],
        'too_many_stops' => ['rank' => 14, 'label' => 'Too many stops', 'category' => RatingCategory::TripAccuracy, 'positive' => false, 'about' => self::DRIVER],
    ];

    /**
     * A category needs this many mentions before its percentage is published.
     *
     * One person saying "clean car" is not "100% clean car". Below this the
     * profile says nothing rather than something it can't stand behind.
     */
    public const HIGHLIGHT_THRESHOLD = 3;

    /**
     * The tags offered for a given rating, in the order they are shown.
     *
     * Star count decides valence, not vocabulary: nobody awards five stars and
     * then reaches for "Reckless driving", and offering it invites a mis-tap
     * that the percentages would then carry forever. Three stars is the mixed
     * case - a ride that was fine apart from one thing - so it offers both.
     *
     * Each chip carries its category so the screen can group them later
     * without a second endpoint, and so a tap is recorded against the thing it
     * counts towards.
     *
     * @return array<int, array{slug: string, label: string, category: string, emoji: string, positive: bool}>
     */
    public static function offered(RatedRole $rateeRole, int $stars): array
    {
        $wanted = match (true) {
            $stars >= 4 => [true],
            $stars === 3 => [true, false],
            $stars >= 1 => [false],
            default => [],
        };

        $offered = [];

        foreach (self::CATALOGUE as $slug => $tag) {
            if (! self::appliesTo($tag['about'], $rateeRole)) {
                continue;
            }

            if (! in_array($tag['positive'], $wanted, true)) {
                continue;
            }

            $offered[] = [
                'slug' => $slug,
                'label' => $tag['label'],
                'category' => $tag['category']->value,
                'emoji' => $tag['category']->emoji(),
                'positive' => $tag['positive'],
                'rank' => $tag['rank'],
            ];
        }

        /*
         * At three stars both valences are on offer. Praise leads, because a
         * three-star ride was mostly fine and burying the good under a list of
         * complaints misreads the rating that was just given.
         */
        usort($offered, fn ($a, $b) => [! $a['positive'], $a['rank']] <=> [! $b['positive'], $b['rank']]);

        return array_map(fn ($tag) => Arr::except($tag, 'rank'), $offered);
    }

    /**
     * How many chips the screen shows before "More". Sent with the vocabulary
     * so the cut-off lives in one place rather than in each client.
     */
    public const CHIPS_BEFORE_MORE = 6;

    /**
     * The slugs a rating of this shape is allowed to carry. Validation asks
     * this so a client can't post "reckless_driving" alongside five stars.
     *
     * @return array<int, string>
     */
    public static function allowed(RatedRole $rateeRole, int $stars): array
    {
        return array_column(self::offered($rateeRole, $stars), 'slug');
    }

    public static function label(string $slug): ?string
    {
        return self::CATALOGUE[$slug]['label'] ?? null;
    }

    /**
     * What a person's tags add up to, for the profile.
     *
     * Returns one line per category - "🚗 Smooth driving 96%" - where the
     * percentage is the share of *mentions in that category* that were praise,
     * and the label is the praise said most often. A category nobody has said
     * enough about is left out entirely.
     *
     * Counted from the ratings themselves rather than kept in a running total:
     * these are read on a profile, not on every request, and a tally that can
     * drift out of step with its own evidence is worse than a query.
     *
     * @return array<int, array{category: string, emoji: string, label: string, percent: int, mentions: int}>
     */
    public static function highlightsFor(User $user, RatedRole $role): array
    {
        $tally = [];

        Rating::query()
            ->where('ratee_id', $user->getKey())
            ->where('ratee_role', $role->value)
            ->whereNotNull('tags')
            ->select('tags')
            ->lazy()
            ->each(function (Rating $rating) use (&$tally) {
                foreach ($rating->tags ?? [] as $slug) {
                    $tag = self::CATALOGUE[$slug] ?? null;

                    if ($tag === null) {
                        continue; // a slug retired since it was recorded
                    }

                    $category = $tag['category']->value;
                    $tally[$category]['mentions'] = ($tally[$category]['mentions'] ?? 0) + 1;

                    if ($tag['positive']) {
                        $tally[$category]['positive'] = ($tally[$category]['positive'] ?? 0) + 1;
                        $tally[$category]['labels'][$slug] = ($tally[$category]['labels'][$slug] ?? 0) + 1;
                    }
                }
            });

        $highlights = [];

        foreach ($tally as $category => $counts) {
            $mentions = $counts['mentions'];

            if ($mentions < self::HIGHLIGHT_THRESHOLD) {
                continue;
            }

            $positive = $counts['positive'] ?? 0;
            $labels = $counts['labels'] ?? [];

            // The headline is whichever praise this person actually gets, so a
            // driver known for being early doesn't read as "smooth driving".
            arsort($labels);
            $topSlug = array_key_first($labels);

            $highlights[] = [
                'category' => $category,
                'emoji' => RatingCategory::from($category)->emoji(),
                'label' => $topSlug !== null
                    ? self::CATALOGUE[$topSlug]['label']
                    : RatingCategory::from($category)->label(),
                'percent' => (int) round($positive / $mentions * 100),
                'mentions' => $mentions,
            ];
        }

        // Strongest first - a profile shows the top few, not all six.
        usort($highlights, fn ($a, $b) => [$b['percent'], $b['mentions']] <=> [$a['percent'], $a['mentions']]);

        return $highlights;
    }

    private static function appliesTo(string $about, RatedRole $role): bool
    {
        return $about === self::BOTH
            || $about === ($role === RatedRole::Driver ? self::DRIVER : self::PASSENGER);
    }
}
