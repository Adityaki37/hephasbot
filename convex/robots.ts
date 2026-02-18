import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveCalibration = mutation({
    args: {
        userId: v.string(),
        name: v.string(),
        calibrationLimits: v.array(v.object({
            min: v.number(),
            max: v.number()
        }))
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("robot_profiles")
            .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("name", args.name))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                calibrationLimits: args.calibrationLimits,
                lastUpdated: Date.now(),
            });
        } else {
            await ctx.db.insert("robot_profiles", {
                userId: args.userId,
                name: args.name,
                calibrationLimits: args.calibrationLimits,
                lastUpdated: Date.now(),
            });
        }
    },
});

export const getProfile = query({
    args: { userId: v.string(), name: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("robot_profiles")
            .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("name", args.name))
            .first();
    },
});

export const listProfiles = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("robot_profiles")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
    },
});

// Delete a profile by name for a specific user
export const deleteProfile = mutation({
    args: { userId: v.string(), name: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("robot_profiles")
            .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("name", args.name))
            .first();

        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});
