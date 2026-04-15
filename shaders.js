// Vertex Shader (вершинный шейдер)
const vertexShaderSource = `#version 300 es
layout(location = 0) in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

// Fragment Shader (фрагментный шейдер)
const fragmentShaderSource = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_zoom;
uniform vec2 u_center;
uniform float u_cx, u_cy;
uniform int u_type, u_palette;
out vec4 fragColor;

vec3 palette(float t, int p) {
    if(p == 0) { // Радужная
        vec3 c = vec3(t, t, t);
        return abs(mod(c * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0;
    }
    if(p == 1) { // Чёрно-белая
        return vec3(t);
    }
    if(p == 2) { // Психоделия
        return 0.5 + 0.5 * sin(vec3(0.0, 0.33, 0.67) * 6.28318 + t * 20.0);
    }
    if(p == 3) { // Инферно
        return mix(vec3(0.0), mix(vec3(0.5, 0.0, 0.0), vec3(1.0, 1.0, 0.8), smoothstep(0.2, 0.8, t)), smoothstep(0.0, 0.5, t));
    }
    if(p == 4) { // Пустота
        return mix(vec3(0.05, 0.0, 0.1), vec3(0.2, 0.5, 1.0), sin(t * 10.0) * 0.5 + 0.5);
    }
    if(p == 5) { // Neon Tokyo
        return mix(vec3(0.1, 0.0, 0.2), mix(vec3(1.0, 0.0, 0.5), vec3(0.0, 1.0, 1.0), t), t);
    }
    if(p == 6) { // ДНК
        return vec3(0.0, t * 0.8, 0.1) + vec3(t*0.2, t*0.2, 0.0);
    }
    if(p == 7) { // Восход
        return mix(vec3(0.2, 0.0, 0.3), vec3(1.0, 0.6, 0.1), t);
    }
    if(p == 8) { // Doom
        return mix(vec3(0.1, 0.0, 0.0), vec3(1.0, 0.2, 0.0), pow(t, 0.8));
    }
    return vec3(1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
    vec2 c = uv / u_zoom + u_center;
    vec2 z;
    float iter = 0.0;
    float maxIter = 100.0 + log(u_zoom + 1.0) * 20.0;

    if (u_type == 0) { // Mandelbrot
        z = vec2(0.0);
    } else if (u_type == 1) { // Julia
        z = uv / u_zoom + u_center;
        c = vec2(u_cx, u_cy);
    } else { // Others
        z = vec2(0.0);
    }

    for (int i = 0; i < 500; i++) {
        if (float(i) > maxIter) break;
        if (dot(z, z) > 4.0) break;

        float x = z.x;
        float y = z.y;
        float x2 = x * x;
        float y2 = y * y;

        if (u_type == 0) { // Mandelbrot
            z = vec2(x2 - y2 + c.x, 2.0 * x * y + c.y);
        } else if (u_type == 1) { // Julia
            z = vec2(x2 - y2 + c.x, 2.0 * x * y + c.y);
        } else if (u_type == 2) { // Burning Ship
            z = vec2(x2 - y2 + c.x, -2.0 * abs(x) * abs(y) + c.y);
        } else if (u_type == 3) { // Multibrot n=3
            z = vec2(x * (x2 - 3.0 * y2) + c.x, y * (3.0 * x2 - y2) + c.y);
        } else if (u_type == 4) { // Tricorn
            z = vec2(x2 - y2 + c.x, -2.0 * x * y + c.y);
        } else if (u_type == 5) { // Celtic
            x = abs(x);
            z = vec2(x * x - y2 + c.x, 2.0 * x * y + c.y);
        }
        
        iter += 1.0;
    }

    if (iter > maxIter - 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        float sn = iter + 1.0 - log(log(dot(z, z))) / log(2.0);
        float t = sn / 50.0;
        vec3 col = palette(fract(t), u_palette);
        fragColor = vec4(col, 1.0);
    }
}`;