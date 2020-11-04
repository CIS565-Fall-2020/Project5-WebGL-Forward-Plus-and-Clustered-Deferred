export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform float u_near;
  uniform float u_far;
  uniform float u_width;
  uniform float u_height;
  uniform mat4 u_viewMat;
  uniform mat4 u_viewProjectionInvMat;
  uniform vec3 u_eye;
  
  varying vec2 v_uv;

  const float exp = 256.0;

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
    vec3 fragColor = vec3(0.0);

    // Extract data from g-buffers and do lighting
    vec4 albedo = texture2D(u_gbuffers[0], v_uv);
    vec4 normal = texture2D(u_gbuffers[1], v_uv);
    vec4 position = texture2D(u_gbuffers[2], v_uv);

    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    vec4 viewPos = u_viewMat * vec4(position.x, position.y, position.z, 1.0);

    const int xSlices = ${params.xSlices};
    const int ySlices = ${params.ySlices};
    const int zSlices = ${params.zSlices};
            
    int z = int((-viewPos.z - u_near) / ((u_far - u_near) / float(zSlices)));
    int x = int(gl_FragCoord.x / (u_width / float(xSlices)));
    int y = int(gl_FragCoord.y / (u_height / float(ySlices)));
    int clusterIdx = x + y * xSlices + z * xSlices * ySlices;

    const int clusterTextureWidth = xSlices * ySlices * zSlices;
    const int clusterTextureHeight = int(ceil(float(${params.maxLightsPerCluster} + 1) / 4.0));
    int realNumLights = int(ExtractFloat(u_clusterbuffer, clusterTextureWidth, clusterTextureHeight, clusterIdx, 0));

    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i >= realNumLights)
        break;
        
      int lightIdx = int(ExtractFloat(u_clusterbuffer, clusterTextureWidth, clusterTextureHeight, clusterIdx, i + 1));;
      Light light = UnpackLight(lightIdx);
      float lightDistance = distance(light.position, position.xyz);
      vec3 L = (light.position - position.xyz) / lightDistance;
      vec3 V = normalize(light.position - u_eye);
      vec3 H = normalize(V + L);

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal.xyz), 0.0);
      float specularIntensity = pow(max(dot(H, normal.xyz), 0.0), exp); 

      fragColor += (albedo.xyz * lambertTerm + specularIntensity) * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo.xyz * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}