export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform mat4 u_viewMatrix;
  uniform vec2 u_nearFarPlane;
  uniform vec2 u_canvasSize;
  uniform vec3 u_cameraPos;
  
  varying vec2 v_uv;

  #define BLINNPHONG 0

  #define TWO_COMPONENT_NORMAL 0

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

#if TWO_COMPONENT_NORMAL
    vec4 texture0 = texture2D(u_gbuffers[0], v_uv);
    vec4 texture1 = texture2D(u_gbuffers[1], v_uv);
    vec3 albedo = texture0.xyz;
    vec3 position = texture1.xyz;
    
    // decode normal
    vec4 nn = vec4(texture0.w * 2.0 - 1.0, texture1.w * 2.0 - 1.0, 1.0, -1.0);
    float l = dot(nn.xyz, -nn.xyw);
    nn.z = l;
    nn.xy *= sqrt(l);
    vec3 normal = nn.xyz * 2.0 + vec3(0.0, 0.0, -1.0);

#else
    vec3 albedo = texture2D(u_gbuffers[0], v_uv).xyz;
    vec3 position = texture2D(u_gbuffers[1], v_uv).xyz;
    vec3 normal = texture2D(u_gbuffers[2], v_uv).xyz;
#endif

    vec3 fragColor = vec3(0.0);

    float xSlices = float(${params.xSlices});
    float ySlices = float(${params.ySlices});
    float zSlices = float(${params.zSlices});
    int nClusters = ${params.xSlices} * ${params.ySlices} * ${params.zSlices};
    int clusterHeight = int(ceil(float(${params.numLights} + 1) / 4.0));

    vec4 vpos = u_viewMatrix * vec4(position, 1.0);

    int x = int(v_uv.x * xSlices);
    int y = int(v_uv.y * ySlices);
    int z = int((-vpos.z - u_nearFarPlane.x) / (u_nearFarPlane.y - u_nearFarPlane.x) * zSlices);

    int clusterId = x + y * ${params.xSlices} + z * ${params.xSlices} * ${params.ySlices};
    
    int lightCount = int(ExtractFloat(u_clusterbuffer, nClusters, clusterHeight, clusterId, 0));

    for (int i = 1; i <= ${params.numLights}; ++i) {
      if (i > lightCount) {
        break;
      }
      int lightId = int(ExtractFloat(u_clusterbuffer, nClusters, clusterHeight, clusterId, i));
      Light light = UnpackLight(lightId);
      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

#if BLINNPHONG
      //vec3 H = 0.5 * (L + normalize(viewPos - position));
      vec3 H = 0.5 * (L + normalize( u_cameraPos - position));
      vec3 specular = vec3(pow(dot(normalize(normal), normalize(H)), 10.0));
      fragColor += albedo * clamp(specular, vec3(0.0), vec3(1.0)) * light.color * vec3(lightIntensity);
#endif
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    fragColor = clamp(fragColor, vec3(0.0), vec3(1.0));

    gl_FragColor = vec4(fragColor, 1.0);

    // NO CLUSTER
    // vec3 fragColor = vec3(0.0);

    // for (int i = 0; i < ${params.numLights}; ++i) {
    //   Light light = UnpackLight(i);
    //   float lightDistance = distance(light.position, position);
    //   vec3 L = (light.position - position) / lightDistance;

    //   float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
    //   float lambertTerm = max(dot(L, normal), 0.0);

    //   fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    // }

    // const vec3 ambientLight = vec3(0.025);
    // fragColor += albedo * ambientLight;

    // gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}