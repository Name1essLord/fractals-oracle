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
    // 0: Радужная
    if(p == 0) { 
        vec3 c = vec3(t, t, t);
        return abs(mod(c * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0;
    }
    // 1: Чёрно-белая
    if(p == 1) return vec3(t);
    
    // 2: Психоделия
    if(p == 2) return 0.5 + 0.5 * sin(vec3(0.0, 0.33, 0.67) * 6.28318 + t * 20.0);
    
    // 3: Инферно
    if(p == 3) return mix(vec3(0.0), mix(vec3(0.5, 0.0, 0.0), vec3(1.0, 1.0, 0.8), smoothstep(0.2, 0.8, t)), smoothstep(0.0, 0.5, t));
    
    // 4: Пустота (Mystic Void)
    if(p == 4) return mix(vec3(0.05, 0.0, 0.1), vec3(0.2, 0.5, 1.0), sin(t * 10.0) * 0.5 + 0.5);
    
    // 5: Neon Tokyo
    if(p == 5) return mix(vec3(0.1, 0.0, 0.2), mix(vec3(1.0, 0.0, 0.5), vec3(0.0, 1.0, 1.0), t), t);
    
    // 6: ДНК
    if(p == 6) return vec3(0.0, t * 0.8, 0.1) + vec3(t*0.2, t*0.2, 0.0);
    
    // 7: Восход
    if(p == 7) return mix(vec3(0.2, 0.0, 0.3), vec3(1.0, 0.6, 0.1), t);
    
    // 8: Doom
    if(p == 8) return mix(vec3(0.1, 0.0, 0.0), vec3(1.0, 0.2, 0.0), pow(t, 0.8));
    
    // 9: Random (Случайная палитра)
    if(p == 9) {
        // Генерация случайного градиента на основе позиции
        return 0.5 + 0.5 * cos(6.28318 * (t * vec3(1.0, 0.7, 0.4) + vec3(0.0, 0.15, 0.20)));
    }    
    return vec3(1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
    vec2 c = uv / u_zoom + u_center;
    vec2 z;
    float iter = 0.0;
    float maxIter = 100.0 + log(u_zoom + 1.0) * 20.0;

    // Инициализация z и c в зависимости от типа
    if (u_type == 0) { // Mandelbrot
        z = vec2(0.0);
    } else if (u_type == 1) { // Julia
        z = uv / u_zoom + u_center;
        c = vec2(u_cx, u_cy);
    } else { // Остальные типы начинают с z=0
        z = vec2(0.0);
    }

    // --- ЦИКЛ ИТЕРАЦИЙ ---
    for (int i = 0; i < 500; i++) {
        if (float(i) > maxIter) break;
        
        // Условие выхода (радиус 4.0 для стандартных, может отличаться для Newton)
        if (u_type == 7) { // Newton имеет другую логику выхода
             if (dot(z, z) > 100.0) break; 
        } else {
             if (dot(z, z) > 4.0) break;
        }

        float x = z.x;
        float y = z.y;
        float x2 = x * x;
        float y2 = y * y;

        // --- ФОРМУЛЫ ФРАКТАЛОВ ---
        
        // 0: Mandelbrot
        if (u_type == 0) {
            z = vec2(x2 - y2 + c.x, 2.0 * x * y + c.y);
        }
        // 1: Julia
        else if (u_type == 1) {
            z = vec2(x2 - y2 + c.x, 2.0 * x * y + c.y);
        }
        // 2: Burning Ship
        else if (u_type == 2) {
            z = vec2(x2 - y2 + c.x, -2.0 * abs(x) * abs(y) + c.y);        }
        // 3: Multibrot (n=3)
        else if (u_type == 3) {
            z = vec2(x * (x2 - 3.0 * y2) + c.x, y * (3.0 * x2 - y2) + c.y);
        }
        // 4: Tricorn
        else if (u_type == 4) {
            z = vec2(x2 - y2 + c.x, -2.0 * x * y + c.y);
        }
        // 5: Celtic
        else if (u_type == 5) {
            x = abs(x);
            z = vec2(x * x - y2 + c.x, 2.0 * x * y + c.y);
        }
        // 6: Biomorphs (Органические - sin/cos)
        else if (u_type == 6) {
            // Добавляем sin/cos к стандартной формуле для создания "клеток"
            float real_part = x2 - y2 + c.x + sin(y * 5.0) * 0.2;
            float imag_part = 2.0 * x * y + c.y + cos(x * 5.0) * 0.2;
            z = vec2(real_part, imag_part);
        }
        // 7: Newton Fractal (z^3 - 1 = 0)
        else if (u_type == 7) {
            // Метод Ньютона: z_new = z - (z^3 - 1) / (3z^2)
            // z^3 = (x+iy)^3 = x^3 - 3xy^2 + i(3x^2y - y^3)
            // z^2 = x^2 - y^2 + i(2xy)
            
            float zr3 = x * (x2 - 3.0 * y2);
            float zi3 = y * (3.0 * x2 - y2);
            
            float denom = 3.0 * (x2 + y2) * (x2 + y2); // |3z^2|^2 примерно, но упрощенно для векторов
            // Полная формула деления комплексных чисел:
            // (A+Bi) / (C+Di) = ((AC+BD) + i(BC-AD)) / (C^2+D^2)
            
            // Числитель: z^3 - 1
            float numR = zr3 - 1.0;
            float numI = zi3;
            
            // Знаменатель производной: 3z^2
            float denR = 3.0 * (x2 - y2);
            float denI = 6.0 * x * y;
            
            float denModSq = denR*denR + denI*denI;
            
            if (denModSq > 0.001) {
                float divR = (numR * denR + numI * denI) / denModSq;
                float divI = (numI * denR - numR * denI) / denModSq;
                z = vec2(x - divR, y - divI);
            } else {
                z = vec2(x, y); // Защита от деления на 0            }
        }

        iter += 1.0;
    }

    // --- ОКРАШИВАНИЕ ---
    
    // Newton Fractal окрашивается по количеству итераций (бассейны притяжения)
    if (u_type == 7) {
         if (iter > maxIter - 1.0) {
             fragColor = vec4(0.0, 0.0, 0.0, 1.0);
         } else {
             float t = iter / 50.0; // Быстрый цикл цвета
             vec3 col = palette(fract(t), u_palette);
             fragColor = vec4(col, 1.0);
         }
         return;
    }

    // Остальные фракталы
    if (iter > maxIter - 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        float sn = iter + 1.0 - log(log(dot(z, z))) / log(2.0);
        float t = sn / 50.0;
        vec3 col = palette(fract(t), u_palette);
        fragColor = vec4(col, 1.0);
    }
}`;