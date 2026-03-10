const std = @import("std");

pub const BackendMode = enum(u32) {
    zig_native_stub = 0,
    external = 1,
};

pub fn backendMode() BackendMode {
    return .zig_native_stub;
}

pub fn sampleOffset(scene_id: u32, phase: f32, time_s: f32, distance: f32) [2]f32 {
    const wobble = 0.04 + distance * 0.025;
    const primary = time_s * (0.85 + @as(f32, @floatFromInt(scene_id)) * 0.23) + phase;
    const secondary = time_s * (1.35 + @as(f32, @floatFromInt(scene_id)) * 0.11) - phase * 0.7;
    return .{
        @sin(primary) * wobble,
        @cos(secondary) * (wobble * 0.78),
    };
}

pub fn influenceFalloff(distance_sq: f32) f32 {
    return 1.0 / (0.18 + distance_sq * 3.2);
}

pub fn seededUnit(index: usize) f32 {
    const seed = @as(u32, @intCast(index * 747796405 + 2891336453));
    const hashed = seed ^ (seed >> 16);
    return @as(f32, @floatFromInt(hashed % 10_000)) / 10_000.0;
}

test "native stub backend is available" {
    try std.testing.expectEqual(BackendMode.zig_native_stub, backendMode());
    try std.testing.expect(influenceFalloff(0.0) > influenceFalloff(1.0));
}

