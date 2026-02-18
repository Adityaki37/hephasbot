import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const storeUser = mutation({
    args: {
        tokenIdentifier: v.string(),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("users")
            .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                name: args.name,
                email: args.email,
            });
            return existing._id;
        } else {
            return await ctx.db.insert("users", {
                tokenIdentifier: args.tokenIdentifier,
                name: args.name,
                email: args.email,
            });
        }
    },
});

export const getUser = query({
    args: { tokenIdentifier: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("users")
            .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
            .first();
    },
});
