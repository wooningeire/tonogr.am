const DITHER_TEX_URL = "./BayerDither8x8.png";
const TIMESCALE = 0.2;

const vertexShaderSource = `#version 300 es
in vec4 a_pos;

out vec2 v_texcoord;

void main() {
    gl_Position = a_pos;

    // Map [-1, 1] to [0, 1]
    v_texcoord = (a_pos.xy + 1.0) / 2.0;
}`;

const fragmentShaderSource = `#version 300 es

precision mediump float;

#define PI 3.1415926535

uniform float time;
uniform vec2 resolution;
uniform sampler2D dither_tex;

in vec2 v_texcoord;

// in VertexData
// {
//     vec4 v_position;
//     vec3 v_normal;
//     vec2 v_texcoord;
// } inData;

out vec4 fragColor;

float red_channel(float t) {
    const float a = 0.244386;
    const float b = 6.27153;
    const float c = -0.792358;
    const float d = 0.799501;
    return a*sin(b*t+c)+d;
}

float green_channel(float t) {
    const float a = 0.193434;
    const float b = 6.31304;
    const float c = -2.36014;
    const float d = 0.771591;
    return a*sin(b*t+c)+d;
}

float blue_channel(float t) {
    const float a = 0.05;
    const float b = 12.5664;
    const float c = -1.5708;
    const float d = -0.218915;
    const float e = 6.28319;
    const float f = 3.6774;
    const float g = 0.687255;
    return a*sin(b*t+c)+d*sin(e*t+f)+g;
}

const float gradient_speed = 8.0;
const float pixel_amount = 32.0;

void main(void)
{
    // vec2 uv = inData.v_texcoord * 4.0 - 2.0;
    vec2 uv = v_texcoord * 4.0 - 2.0;
    uv.y *= resolution.y / resolution.x;

    vec4 colors = vec4(
        red_channel(mod(-time + uv.x / gradient_speed, 1.0)),
        green_channel(mod(-time + uv.x / gradient_speed, 1.0)),
        blue_channel(mod(-time + uv.x / gradient_speed, 1.0)),
        1.0
    );

    uv = floor(uv * pixel_amount) / pixel_amount;
    vec4 dither = texture(dither_tex, uv * (pixel_amount / 8.0));

    uv.x = sin(uv.x * 2.0 + PI + time);

    float binary = float(uv.x / 2.0 > uv.y) * 2.0 - 1.0;
    float mult = (0.535398 * binary) * uv.x + 1.0354;
    float map = abs((uv.x / 2.0) - uv.y) / mult;
    float invert = 1.0 - map;

    vec4 sine = step(dither, vec4(invert, invert, invert, 1.0));

    if (sine.x > 0.5) {
        fragColor = colors;
    } else {
        fragColor = vec4(0.101960784314, 0.101960784314, 0.101960784314, 1.0);
    }
}`;


const canvas = document.querySelector("canvas");

const gl = canvas.getContext("webgl2");


//#region Shader setup

const vertexShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertexShader, vertexShaderSource);
gl.compileShader(vertexShader);

const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragmentShader, fragmentShaderSource);
gl.compileShader(fragmentShader);

const glProgram = gl.createProgram();
gl.attachShader(glProgram, vertexShader);
gl.attachShader(glProgram, fragmentShader);
gl.linkProgram(glProgram);

gl.useProgram(glProgram);

//#endregion


//#region Setting attributes

const vertCoords = new Float32Array([
    // Coordinates of the triangles that cover the canvas
    -1, -1,
    -1, 1,
    1, -1,

    -1, 1,
    1, -1,
    1, 1,
]);

const COORD_DIMENSION = 2;
const nVerts = vertCoords.length / COORD_DIMENSION;

const vertBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertCoords, gl.STATIC_DRAW);

const posAttr = gl.getAttribLocation(glProgram, "a_pos");
gl.vertexAttribPointer(posAttr, COORD_DIMENSION, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(posAttr);

//#endregion


//#region Setting uniforms

const resolutionUnif = gl.getUniformLocation(glProgram, "resolution");
gl.uniform2fv(resolutionUnif, [canvas.width, canvas.height]);


const timeUnif = gl.getUniformLocation(glProgram, "time");
gl.uniform1f(timeUnif, 0);


const texture = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);

gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

const textureImg = new Image();
textureImg.addEventListener("load", () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImg);
}, {once: true});
textureImg.src = DITHER_TEX_URL;

const textureUnif = gl.getUniformLocation(glProgram, "dither_tex");
gl.uniform1i(textureUnif, 0);

//#endregion


const resizeCanvasAndViewport = () => {
    // Scale up here (by `devicePixelRatio`) and scale down in CSS to appear sharp on high-DPI displays
    // Canvas is downsized to 100vw and 100vh in CSS
    canvas.width = document.documentElement.clientWidth * devicePixelRatio;
    canvas.height = document.documentElement.clientHeight * devicePixelRatio;

    gl.uniform2fv(resolutionUnif, [canvas.width, canvas.height]);
    gl.viewport(0, 0, canvas.width, canvas.height);
};

addEventListener("resize", resizeCanvasAndViewport);
resizeCanvasAndViewport();


const draw = (now) => {
    gl.uniform1f(timeUnif, now / 1000 * TIMESCALE);

    gl.drawArrays(gl.TRIANGLES, 0, nVerts);
    requestAnimationFrame(draw);
};
requestAnimationFrame(draw);
