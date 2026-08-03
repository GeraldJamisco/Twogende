<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    /**
     * The signed-in user. The app calls this on launch to decide which tabs to
     * show, so it carries the verification flags rather than making the client
     * infer them.
     */
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    /**
     * Edit your own details.
     *
     * This is where a brand-new account gets its name: verifying a code
     * creates the account, so the first thing a new user does is fill this in.
     */
    public function update(Request $request): UserResource
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:255'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:500'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
        ]);

        $request->user()->update($validated);

        return new UserResource($request->user()->refresh());
    }
}
