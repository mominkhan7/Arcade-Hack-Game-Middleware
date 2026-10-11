#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// Live marbling. Each pixel walks the operation list backwards to find which
// ink it came from. Mirrors Marbling.ink(at:ops:) in Swift; keep them in step.
// ops: 8 floats per operation (see MarbleOp.encoded).
// palette: paper rgb, then each ink rgb.
// origin and size place the square tray in the view, so a tall view is covered, not stretched.
[[ stitchable ]] half4 marble(float2 position, half4 color, float2 origin, float2 size,
                              device const float *ops, int opsCount,
                              device const float *palette, int paletteCount) {
    float2 p = (position - origin) / size;
    int count = opsCount / 8;
    int inkCount = paletteCount / 3 - 1;

    for (int i = count - 1; i >= 0; i--) {
        device const float *o = ops + i * 8;
        int kind = int(o[0]);
        if (kind == 0) {
            float2 c = float2(o[1], o[2]);
            float r2 = o[3] * o[3];
            float2 d = p - c;
            float d2 = dot(d, d);
            if (d2 < r2) {
                int ink = 1 + (int(o[4]) % max(inkCount, 1));
                return half4(half(palette[ink * 3]), half(palette[ink * 3 + 1]), half(palette[ink * 3 + 2]), 1.0h);
            }
            p = c + d * sqrt(1.0 - r2 / d2);
        } else if (kind == 1) {
            float2 origin = float2(o[1], o[2]);
            float2 m = float2(o[3], o[4]);
            float2 n = float2(-m.y, m.x);
            float dist = abs(dot(p - origin, n));
            p -= m * (o[5] * o[6] / (dist + o[6]));
        } else if (kind == 3) {
            // A comb: each point feels only its nearest tine, and midpoints between tines stay put.
            float2 origin = float2(o[1], o[2]);
            float2 m = float2(o[3], o[4]);
            float2 n = float2(-m.y, m.x);
            float lambda = o[6], spacing = o[7];
            float off = dot(p - origin, n) / spacing;
            float dn = abs(off - floor(off + 0.5)) * spacing;
            float edge = lambda / (0.5 * spacing + lambda);
            p -= m * (o[5] * (lambda / (dn + lambda) - edge) / (1.0 - edge));
        } else if (kind == 2) {
            float2 a = float2(o[1], o[2]);
            float2 ab = float2(o[3], o[4]) - a;
            float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
            float2 q = a + ab * t;
            float reach = o[5];
            p -= ab * exp(-dot(p - q, p - q) / (reach * reach));
        }
    }
    return half4(half(palette[0]), half(palette[1]), half(palette[2]), 1.0h);
}
