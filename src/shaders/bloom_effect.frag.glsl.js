export default function(params) {
    return `
#version 100
precision highp float;

uniform sampler2D u_RenderedTexture;
uniform float u_canvas_height;
uniform float u_canvas_width;

varying vec2 v_uv;

// Input the kernel pos, current fragment uv pos and texel size. Return the uv pos at the tar kernel pos
vec2 GetUVPos(ivec2 kernelPos, vec2 texelSize, vec2 currentFragUVPos)
{
    // Init tar uv pos
    vec2 tUVPos = vec2(0, 0);

    // get the relative kernel pos
    ivec2 tRelativeKernelPos = kernelPos - ivec2(${params.kernelDim / 2}, ${params.kernelDim / 2});

    // get the uv pos kernel pos
    tUVPos.x = currentFragUVPos.x + float(tRelativeKernelPos.x) * texelSize.x;
    tUVPos.y = currentFragUVPos.y + float(tRelativeKernelPos.y) * texelSize.y;

    return tUVPos;
}

float RGBLuminance(vec3 color)
{
    return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b);
}


void main() {
    // Construct kernel
    float blur_kernel[${params.kernelDim * params.kernelDim}];
    float sigma = 8.0;
    float r, s = 2.0 * sigma * sigma;
    float M_PI = 3.1415926;
    float sum = 0.0;
    int kernel_start = -${params.kernelDim} / 2;
    int kernel_end = ${params.kernelDim} / 2;
    for (int x = -${params.kernelDim} / 2; x <= ${params.kernelDim} / 2; ++x) {
        for (int y = -${params.kernelDim} / 2; y <= ${params.kernelDim} / 2; ++y) {
            r = sqrt(float(x * x + y * y));
            blur_kernel[(x + ${params.kernelDim} / 2) * ${params.kernelDim} + (y + ${params.kernelDim} / 2)] = (exp(-(r * r) / s)) / (M_PI * s);
            sum += blur_kernel[(x + ${params.kernelDim} / 2) * ${params.kernelDim} + (y + ${params.kernelDim} / 2)];
        }
    }
    // normalize the kernel
    for (int i = 0; i < ${params.kernelDim * params.kernelDim}; ++i) {
        blur_kernel[i] /= sum;
    }

    // texel_size in the coord of uv
    vec2 texel_size = vec2(1.0 / u_canvas_width, 1.0 / u_canvas_height);
    // vec2 texel_size = vec2(1.0 / 1094.0, 1.0 / 779.0);

    vec3 currentColor = vec3(texture2D(u_RenderedTexture, v_uv));
    vec3 resColor = vec3(0, 0, 0);

    // accumulate the surrounded texel color in weight
    
    for(int row = 0; row < ${params.kernelDim}; row++){
        for(int col = 0; col < ${params.kernelDim}; col++){
            // get the uv pos of the target surrounded texel
            vec2 tUVPos = GetUVPos(ivec2(row, col), texel_size, v_uv);
            // get the weighted color of the target surrounded texel
            // get the weight of the color
            float tWeight = blur_kernel[row * ${params.kernelDim} + col];
            // get the weighted color
            vec3 tWeightColor = vec3(tWeight * texture2D(u_RenderedTexture, tUVPos));
            // add this target surrounded texel color to the resCol
            resColor += tWeightColor;
        }
    }
    
    // calculate luminance from rgb
    float luminance = RGBLuminance(resColor);

    // set the threshold
    float threshold = 0.3;

    // factor the color into average if its luminance is higher than the threshol
    if(luminance > threshold)
    {
        // empty the resColor
        resColor = vec3(0, 0, 0);
        for(int row = 0; row < ${params.kernelDim}; row++)
        {
            for(int col = 0; col < ${params.kernelDim}; col++)
            {
                // get the uv pos of the target surrounded texel
                vec2 tUVPos = GetUVPos(ivec2(row, col), texel_size, v_uv);

                // get the tar texel color
                vec3 tWeightColor = vec3(texture2D(u_RenderedTexture, tUVPos));

                // add this target surrounded texel color to the resCol
                resColor += tWeightColor;
            }
        }
        // factor the accumulation color
        resColor /= float(${params.kernelDim * params.kernelDim});
    }
    

    // resColor /= float(${params.kernelDim * params.kernelDim});
    gl_FragColor = vec4(currentColor + resColor, 1.0);
}
`;
}

