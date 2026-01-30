import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const storeUser = mutation({
    args: {
        tokenIdentifier: v.string(),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        profileImage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check if we've already stored this user
        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
            .unique();

        if (user !== null) {
            // If we've seen this user before, update their name/email/etc.
            // just in case it changed.
            const id = user._id;
            await ctx.db.patch(id, {
                name: args.name,
                email: args.email,
                profileImage: args.profileImage,
            });
            return id;
        }

        // If it's a new identifier, create a new user.
        return await ctx.db.insert("users", {
            tokenIdentifier: args.tokenIdentifier,
            name: args.name,
            email: args.email,
            profileImage: args.profileImage,
        });
    },
});

export const viewer = query({
    args: { tokenIdentifier: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
            .unique();
        return user;
    }
});
