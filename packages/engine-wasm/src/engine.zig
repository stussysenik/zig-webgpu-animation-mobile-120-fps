const std = @import("std");
const kernels = @import("external_kernels.zig");

const max_particles = 400;
const tau = std.math.tau;

const Scene = enum(u32) {
    orbit_weave = 0,
    ripple_grid = 1,
    bloom_field = 2,
};

const Quality = enum(u32) {
    high = 0,
    balanced = 1,
    battery = 2,
};

const Particle = extern struct {
    x: f32 = 0,
    y: f32 = 0,
    r: f32 = 0,
    g: f32 = 0,
    b: f32 = 0,
    size: f32 = 0,
    vx: f32 = 0,
    vy: f32 = 0,
};

const PointerState = struct {
    active: bool = false,
    x: f32 = 0,
    y: f32 = 0,
    dx: f32 = 0,
    dy: f32 = 0,
};

var particles: [max_particles]Particle = [_]Particle{.{}} ** max_particles;
var anchors: [max_particles][2]f32 = [_][2]f32{.{ 0, 0 }} ** max_particles;
var phase_offsets: [max_particles]f32 = [_]f32{0} ** max_particles;
var scene_distances: [max_particles]f32 = [_]f32{0} ** max_particles;

var particle_count: usize = 0;
var current_scene: Scene = .orbit_weave;
var current_quality: Quality = .balanced;
var viewport_width: f32 = 390;
var viewport_height: f32 = 844;
var viewport_dpr: f32 = 2;
var pointer = PointerState{};
var elapsed_s: f32 = 0;
var average_energy: f32 = 0;

pub export fn init_engine(width: f32, height: f32, dpr: f32, quality: u32) void {
    resize(width, height, dpr);
    set_quality_profile(quality);
    load_scene(@intFromEnum(current_scene));
}

pub export fn resize(width: f32, height: f32, dpr: f32) void {
    viewport_width = if (width > 0) width else 390;
    viewport_height = if (height > 0) height else 844;
    viewport_dpr = if (dpr > 0) dpr else 1;
}

pub export fn set_quality_profile(profile: u32) void {
    current_quality = switch (profile) {
        0 => .high,
        2 => .battery,
        else => .balanced,
    };
}

pub export fn load_scene(scene_id: u32) void {
    current_scene = switch (scene_id) {
        1 => .ripple_grid,
        2 => .bloom_field,
        else => .orbit_weave,
    };
    elapsed_s = 0;
    pointer = PointerState{};
    setupScene();
}

pub export fn update_pointer(x: f32, y: f32, dx: f32, dy: f32, active: u32) void {
    pointer = .{
        .active = active != 0,
        .x = x,
        .y = y,
        .dx = dx,
        .dy = dy,
    };
}

pub export fn step(dt_ms: f32) void {
    const dt_clamped_ms = std.math.clamp(dt_ms, 4.0, 33.0);
    const dt = dt_clamped_ms / 1000.0;
    elapsed_s += dt;

    var total_speed: f32 = 0;
    for (0..particle_count) |index| {
        var particle = &particles[index];
        const anchor = anchors[index];
        const scene_distance = scene_distances[index];
        const offset = kernels.sampleOffset(@intFromEnum(current_scene), phase_offsets[index], elapsed_s, scene_distance);

        var target_x = anchor[0] + offset[0];
        var target_y = anchor[1] + offset[1];
        var stiffness: f32 = 6.2;
        var damping: f32 = 0.96;

        switch (current_scene) {
            .orbit_weave => {
                const angle = phase_offsets[index] + elapsed_s * 0.7;
                target_x += @cos(angle * 1.1) * 0.08;
                target_y += @sin(angle * 0.9) * 0.08;
                stiffness = 8.1;
                damping = 0.955;
            },
            .ripple_grid => {
                const phase = phase_offsets[index];
                target_y += @sin((anchor[0] * 5.4) + elapsed_s * 2.8 + phase) * 0.09;
                target_x += @cos((anchor[1] * 4.3) - elapsed_s * 1.2 + phase) * 0.03;
                stiffness = 7.2;
                damping = 0.952;
            },
            .bloom_field => {
                const swirl = phase_offsets[index] + elapsed_s * (0.65 + scene_distance * 0.4);
                target_x += @cos(swirl) * (0.1 + scene_distance * 0.07);
                target_y += @sin(swirl * 1.3) * (0.08 + scene_distance * 0.06);
                stiffness = 5.4;
                damping = 0.965;
            },
        }

        var ax = (target_x - particle.x) * stiffness;
        var ay = (target_y - particle.y) * stiffness;

        if (pointer.active) {
            const px = particle.x - pointer.x;
            const py = particle.y - pointer.y;
            const distance_sq = (px * px) + (py * py);
            const influence = kernels.influenceFalloff(distance_sq);

            switch (current_scene) {
                .orbit_weave => {
                    ax += (-py * 2.3 + pointer.dx * 9.0) * influence;
                    ay += (px * 2.3 + pointer.dy * 9.0) * influence;
                },
                .ripple_grid => {
                    ax += px * influence * 5.2 + pointer.dx * influence * 4.0;
                    ay += py * influence * 5.2 + pointer.dy * influence * 4.0;
                },
                .bloom_field => {
                    ax += (-px * 3.8 + pointer.dx * 6.5) * influence;
                    ay += (-py * 3.8 + pointer.dy * 6.5) * influence;
                },
            }
        }

        particle.vx = (particle.vx + ax * dt) * damping;
        particle.vy = (particle.vy + ay * dt) * damping;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        total_speed += @sqrt((particle.vx * particle.vx) + (particle.vy * particle.vy));
    }

    average_energy = if (particle_count == 0) 0 else total_speed / @as(f32, @floatFromInt(particle_count));
}

pub export fn get_particle_count() u32 {
    return @intCast(particle_count);
}

pub export fn get_particle_stride_floats() u32 {
    return @sizeOf(Particle) / @sizeOf(f32);
}

pub export fn get_particle_data_ptr() [*]const f32 {
    return @ptrCast(&particles[0]);
}

pub export fn get_average_energy() f32 {
    return average_energy;
}

pub export fn get_kernel_mode() u32 {
    return @intFromEnum(kernels.backendMode());
}

fn setupScene() void {
    particle_count = capacityFor(current_scene, current_quality);

    switch (current_scene) {
        .orbit_weave => configureOrbitWeave(),
        .ripple_grid => configureRippleGrid(),
        .bloom_field => configureBloomField(),
    }
}

fn capacityFor(scene: Scene, quality: Quality) usize {
    return switch (scene) {
        .orbit_weave => switch (quality) {
            .high => 240,
            .balanced => 180,
            .battery => 120,
        },
        .ripple_grid => switch (quality) {
            .high => 324,
            .balanced => 256,
            .battery => 144,
        },
        .bloom_field => switch (quality) {
            .high => 300,
            .balanced => 220,
            .battery => 160,
        },
    };
}

fn configureOrbitWeave() void {
    const layers: [3]usize = .{ 48, 72, 120 };
    const colors: [3][3]f32 = .{
        .{ 0.47, 0.92, 0.88 },
        .{ 0.99, 0.73, 0.37 },
        .{ 0.60, 0.82, 0.98 },
    };

    var layer_index: usize = 0;
    var offset_index: usize = 0;
    while (offset_index < particle_count) : (layer_index += 1) {
        const layer_particles = @min(layers[@min(layer_index, layers.len - 1)], particle_count - offset_index);
        const radius = 0.18 + @as(f32, @floatFromInt(layer_index)) * 0.17;
        for (0..layer_particles) |local_index| {
            const index = offset_index + local_index;
            const progress = @as(f32, @floatFromInt(local_index)) / @as(f32, @floatFromInt(layer_particles));
            const angle = progress * tau + radius * 1.8;
            anchors[index] = .{
                @cos(angle) * radius,
                @sin(angle) * radius,
            };
            phase_offsets[index] = angle;
            scene_distances[index] = radius;
            particles[index] = .{
                .x = anchors[index][0],
                .y = anchors[index][1],
                .r = colors[layer_index % colors.len][0],
                .g = colors[layer_index % colors.len][1],
                .b = colors[layer_index % colors.len][2],
                .size = 0.018 + @as(f32, @floatFromInt(layer_index)) * 0.005,
                .vx = 0,
                .vy = 0,
            };
        }
        offset_index += layer_particles;
    }
}

fn configureRippleGrid() void {
    const grid_side = @as(usize, @intFromFloat(@floor(@sqrt(@as(f32, @floatFromInt(particle_count))))));
    const safe_side = @max(grid_side, 1);
    const total = safe_side * safe_side;
    particle_count = total;

    var index: usize = 0;
    while (index < particle_count) : (index += 1) {
        const column = index % safe_side;
        const row = index / safe_side;
        const fx = (@as(f32, @floatFromInt(column)) / @as(f32, @floatFromInt(safe_side -| 1))) * 2.0 - 1.0;
        const fy = (@as(f32, @floatFromInt(row)) / @as(f32, @floatFromInt(safe_side -| 1))) * 2.0 - 1.0;
        const x = fx * 0.76;
        const y = fy * 0.52;
        const phase = (@as(f32, @floatFromInt(column + row)) * 0.21);
        anchors[index] = .{ x, y };
        phase_offsets[index] = phase;
        scene_distances[index] = @sqrt(x * x + y * y);
        particles[index] = .{
            .x = x,
            .y = y,
            .r = 0.59 + fy * 0.1,
            .g = 0.77 + fx * 0.07,
            .b = 0.96,
            .size = 0.015,
            .vx = 0,
            .vy = 0,
        };
    }
}

fn configureBloomField() void {
    for (0..particle_count) |index| {
        const unit_a = kernels.seededUnit(index);
        const unit_b = kernels.seededUnit(index + 17);
        const angle = unit_a * tau;
        const radius = 0.12 + std.math.pow(f32, unit_b, 0.8) * 0.66;
        const x = @cos(angle) * radius;
        const y = @sin(angle) * radius * 0.72;
        anchors[index] = .{ x * 0.26, y * 0.26 };
        phase_offsets[index] = angle;
        scene_distances[index] = radius;
        particles[index] = .{
            .x = x * 0.65,
            .y = y * 0.65,
            .r = 0.98,
            .g = 0.57 + unit_b * 0.18,
            .b = 0.34 + unit_a * 0.36,
            .size = 0.012 + unit_b * 0.014,
            .vx = (0.5 - unit_a) * 0.2,
            .vy = (0.5 - unit_b) * 0.2,
        };
    }
}

test "quality capacity stays within engine limits" {
    try std.testing.expect(capacityFor(.orbit_weave, .high) <= max_particles);
    try std.testing.expect(capacityFor(.ripple_grid, .high) <= max_particles);
    try std.testing.expect(capacityFor(.bloom_field, .high) <= max_particles);
}

test "scene setup produces visible particles" {
    set_quality_profile(0);
    load_scene(0);
    const before_energy = get_average_energy();
    step(16.6);
    try std.testing.expect(get_particle_count() > 0);
    try std.testing.expect(get_average_energy() >= before_energy);
}
