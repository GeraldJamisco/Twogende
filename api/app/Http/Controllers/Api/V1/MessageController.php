<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\MessageKind;
use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
use App\Http\Resources\MessageResource;
use App\Models\Booking;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Messages between a passenger and their driver.
 *
 * A booking is the conversation — you can only message somebody because one of
 * you asked for a seat on the other's trip. That means BookingPolicy::view()
 * already answers "may these two people talk", and there's no second set of
 * permissions to keep in step.
 */
class MessageController extends Controller
{
    /**
     * Every conversation this user is part of, as driver or passenger,
     * most-recently-active first. Backs the Chats tab.
     */
    public function conversations(Request $request): AnonymousResourceCollection
    {
        $userId = $request->user()->getKey();

        $bookings = Booking::query()
            ->with(['passenger', 'trip.driver'])
            ->where(fn ($query) => $query
                ->where('passenger_id', $userId)
                ->orWhereHas('trip', fn ($trip) => $trip->where('driver_id', $userId))
            )
            // A booking nobody has written on isn't a conversation yet.
            ->whereHas('messages')
            ->withCount([
                'messages as unread_count' => fn ($q) => $q
                    ->whereNull('read_at')
                    ->where('sender_id', '!=', $userId),
            ])
            ->with(['messages' => fn ($q) => $q->latest('id')->limit(1)])
            ->get()
            ->sortByDesc(fn (Booking $booking) => $booking->messages->first()?->created_at)
            ->values();

        return ConversationResource::collection($bookings);
    }

    /**
     * The thread on one booking, oldest first.
     *
     * Reading it marks the other side's messages as read — opening a
     * conversation is the only sensible definition of having seen it.
     */
    public function index(Request $request, Booking $booking): AnonymousResourceCollection
    {
        $this->authorize('view', $booking);

        $booking->messages()
            ->whereNull('read_at')
            ->where('sender_id', '!=', $request->user()->getKey())
            ->update(['read_at' => now()]);

        return MessageResource::collection(
            $booking->messages()->with('sender')->orderBy('id')->get()
        );
    }

    /**
     * Streams a chat photo to whichever of the two people asked for it.
     *
     * These never get a public URL — the same rule that decides who may read
     * the conversation decides who may see its pictures.
     */
    public function image(Request $request, Message $message): StreamedResponse
    {
        $this->authorize('view', $message->booking);

        abort_unless($message->image_path, 404);

        $disk = Storage::disk((string) config('twogende.uploads.identity_disk'));
        abort_unless($disk->exists($message->image_path), 404);

        return $disk->response($message->image_path);
    }

    public function store(Request $request, Booking $booking): JsonResponse
    {
        $this->authorize('view', $booking);

        if (! $booking->chatIsOpen()) {
            // The screen promises the chat stays open until a given moment.
            // Enforcing it here is what makes that true.
            return response()->json([
                'message' => 'This chat has closed for this ride.',
            ], 422);
        }

        $validated = $request->validate([
            'kind' => ['sometimes', Rule::in(MessageKind::sendable())],

            // Text is required for a plain message, optional as a caption or
            // a place name on the other kinds.
            'body' => [
                Rule::requiredIf(fn () => ($request->input('kind', 'user')) === 'user'),
                'nullable', 'string', 'max:2000',
            ],

            'latitude' => ['required_if:kind,location', 'numeric', 'between:-90,90'],
            'longitude' => ['required_if:kind,location', 'numeric', 'between:-180,180'],
            'image' => [
                'required_if:kind,image',
                'image',
                'max:'.(int) config('twogende.uploads.max_image_kb'),
            ],
        ]);

        $kind = MessageKind::from($validated['kind'] ?? MessageKind::User->value);

        $message = new Message(['body' => $validated['body'] ?? null]);
        $message->booking_id = $booking->getKey();
        $message->sender_id = $request->user()->getKey();
        $message->kind = $kind;

        if ($kind === MessageKind::Location) {
            $message->latitude = $validated['latitude'];
            $message->longitude = $validated['longitude'];
        }

        if ($kind === MessageKind::Image) {
            // Private disk: a photo of where somebody is standing is a photo
            // of where somebody is. Served through an authorised route only.
            $message->image_path = $request->file('image')->store(
                'chat/'.$booking->getKey(),
                (string) config('twogende.uploads.identity_disk'),
            );
        }

        $message->save();

        return (new MessageResource($message->load('sender')))
            ->response()
            ->setStatusCode(201);
    }
}
