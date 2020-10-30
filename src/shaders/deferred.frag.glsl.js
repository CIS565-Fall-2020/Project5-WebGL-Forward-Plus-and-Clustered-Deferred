export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;

  uniform int u_xSlices;
  uniform int u_ySlices;
  uniform int u_zSlices;
  uniform int u_screenWidth;
  uniform int u_screenHeight;
  uniform float u_zminView;
  uniform float u_zmaxView;
  uniform ivec2 u_clusterSize;
  uniform vec3 u_cameraPos;
  
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
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.0));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.5));
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
    // TODO: extract data from g buffers and do lighting
    vec3 col = vec3(texture2D(u_gbuffers[0], v_uv));
    vec3 norm = vec3(texture2D(u_gbuffers[1], v_uv));
    vec3 pos = vec3(texture2D(u_gbuffers[2], v_uv));
    //vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    vec3 fragColor = vec3(0.0);

    // Calculate cluster index
    vec4 view = u_viewMatrix * vec4(pos, 1.0);
    float viewDepth = -view.z;

    int cx = int(float(u_xSlices) * gl_FragCoord.x / float(u_screenWidth));
    int cy = int(float(u_ySlices) * gl_FragCoord.y / float(u_screenHeight));
    int cz = int(float(u_zSlices) * (viewDepth - u_zminView) / (u_zmaxView - u_zminView));
    int cid = cz * u_xSlices * u_ySlices + cy * u_xSlices + cx;

    int lightNum = int(ExtractFloat(u_clusterbuffer, u_clusterSize.x, u_clusterSize.y, cid, 0) + 0.5);
    for (int i = 1; i <= ${params.numLights}; ++i)
    {
      if (i > lightNum)
      {
        break;
      }
      int lightid = int(ExtractFloat(u_clusterbuffer, u_clusterSize.x, u_clusterSize.y, cid, i) + 0.1);
      Light light = UnpackLight(lightid);
      float lightDistance = distance(light.position, pos);
      vec3 L = (light.position - pos) / lightDistance;

      vec3 V = normalize(u_cameraPos - pos);
      vec3 H = normalize(L + V);
      float specularTerm = max(pow(dot(H, norm), 2.0), 0.0);

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, norm), 0.0);
      // fragColor += col * (lambertTerm) * light.color * vec3(lightIntensity);
      fragColor += col * (lambertTerm + specularTerm) * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += col * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    //gl_FragColor = vec4(u_cameraPos, 1.0);
  }
  `;
}