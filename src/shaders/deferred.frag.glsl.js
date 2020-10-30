export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform mat4 u_viewMatrix;
  uniform mat4 u_viewProjectionMatrix;
  uniform sampler2D u_lightbuffer;

  uniform float u_zDist;

  uniform sampler2D u_clusterbuffer;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  varying vec2 v_uv;

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }
  
  void main() {
    vec3 position = vec3(texture2D(u_gbuffers[0], v_uv));
    vec3 albedo = vec3(texture2D(u_gbuffers[2], v_uv));
    vec3 normal = vec3(texture2D(u_gbuffers[1], v_uv));

    vec3 fragColor = vec3(0.0);

    // calculate frustum index
    int frustumX = int(gl_FragCoord.x / float(${params.width}) * float(${params.numXSlices}));
    int frustumY = int(gl_FragCoord.y / float(${params.height}) * float(${params.numYSlices}));
    int frustumZ = int((u_viewMatrix * vec4(position, 1)).z / u_zDist * float(${params.numZSlices}));
    int frustumIndex = frustumX + frustumY * ${params.numXSlices} + frustumZ * ${params.numXSlices} * ${params.numYSlices};

    int textHeight = int(ceil(float(${params.numLights + 1}) / 4.0));

    int numLights = int(ExtractFloat(u_clusterbuffer,
                                      ${params.numClusters},
                                      textHeight,
                                      frustumIndex,
                                      0));

    for(int i = 0; i < ${params.numLights}; i++) {
      if(i >= numLights) break;
      int lightIndex = int(ExtractFloat(u_clusterbuffer,
                                        ${params.numClusters},
                                        textHeight,
                                        frustumIndex,
                                        i + 1));

      Light light = UnpackLight(lightIndex);

      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = floor(max(dot(L, normal), 0.0) * 5.0) / 5.0;
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    // POST-PROCESS: TOON SHADER (lines)
    float grey = 0.21 * fragColor.x + 0.72 * fragColor.y + 0.07 * fragColor.z;
    if(grey < 0.2) {
      fragColor *= 1.0 + sin(v_uv.x * float(${params.width}) + v_uv.y * float(${params.height}));
    }
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}