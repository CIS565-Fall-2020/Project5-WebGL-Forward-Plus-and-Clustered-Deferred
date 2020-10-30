export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  // Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;

  uniform int u_xSlices;
  uniform int u_ySlices;
  uniform int u_zSlices;
  
  uniform mat4 u_viewMatrix;
  uniform int u_clusterLightDim;

  uniform float u_near;
  uniform float u_far;
  uniform float u_canvasHeight;
  uniform float u_canvasWidth;

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

  int UnpackClusters(int totalClusters, int cid, int lid) {
    return int(ExtractFloat(u_clusterbuffer, totalClusters, u_clusterLightDim, cid, lid));
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
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    vec3 albedo = gb0.rgb;
    vec3 v_position = gb1.xyz;
    float angle = gb0[3];
    float normY = gb1[3];
    float r = sqrt(1.0 - normY * normY);
    vec3 normal = vec3(r * sin(angle), gb1[3], r * cos(angle));

    vec3 fragColor = vec3(0.0);

    // Determine the cluster for this fragment
    vec4 posInCamera = u_viewMatrix * vec4(v_position, 1.0);
    int x = int(float(u_xSlices) * gl_FragCoord.x / u_canvasWidth);
    int y = int(float(u_ySlices) * gl_FragCoord.y / u_canvasHeight);
    int z = int(float(u_zSlices) * (-posInCamera.z - u_near) / (u_far - u_near));
    int cid = z * u_xSlices * u_ySlices + y * u_xSlices + x;

    // Read the number of lights in this cluster
    int totalClusters = u_xSlices * u_ySlices * u_zSlices;
    int lightsInCluster = UnpackClusters(totalClusters, cid, 0);

    for (int i = 0; i < ${params.numLights}; ++i) { // Cannot have dynamic loop
      if (i >= lightsInCluster) {
        continue;
      }
      // Read in the lights in that cluster
      int lightIdx = UnpackClusters(totalClusters, cid, i + 1);
      Light light = UnpackLight(lightIdx);
   
      // Do shading
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      vec3 viewInCamera = -normalize(posInCamera.xyz);
      vec3 normalInCamera = normalize(vec3(u_viewMatrix * vec4(normal, 0)));
      vec3 H = normalize(viewInCamera + normalize(vec3(u_viewMatrix * vec4(L, 0))));
      float blinnTerm = pow(max(dot(normalInCamera, H), 0.0), 5.0);

      fragColor += albedo * (lambertTerm + blinnTerm) * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}