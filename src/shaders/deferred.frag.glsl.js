export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform mat4 u_viewProjectionMatrix;
  uniform vec2 u_cameraNF;
  uniform vec3 u_cameraPos;

  varying vec2 v_uv;
  
  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

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
    vec3 position = texture2D(u_gbuffers[0], v_uv).xyz;
    vec3 albedo = texture2D(u_gbuffers[1], v_uv).rgb;
    vec3 normal = texture2D(u_gbuffers[2], v_uv).xyz;
    vec4 transformed;

    if (${params.numGBuffers} == 4) {
      transformed = texture2D(u_gbuffers[${params.numGBuffers} - 1], v_uv);
    } else {
      // optimized version: numGBuffers = 3
      transformed = u_viewProjectionMatrix * vec4(position, 1.0);
    }
    
    vec3 fragColor = vec3(0.0);

    float near = u_cameraNF.x;
    float far = u_cameraNF.y;
    float dx = 2.0 / float(${params.xSlices});
    float dy = 2.0 / float(${params.ySlices});
    float dz = (far - near) / float(${params.zSlices});

    vec4 scaled = transformed / transformed.w;
    int kx = int(floor((scaled.x + 1.0) / dx));
    int ky = int(floor((scaled.y + 1.0) / dy));
    int kz = int(floor((transformed.z - near) / dz));
    int cidx = kx + ky * ${params.xSlices} + kz * ${params.xSlices} * ${params.ySlices};
    int numClusters = int(${params.xSlices} * ${params.ySlices} * ${params.zSlices});
    int count = int(ExtractFloat(u_clusterbuffer, numClusters, ${params.clusterWidth}, cidx, 0));
    const int max_iter = ${params.clusterWidth} * 4;

    // hard coded shininess
    const float shin = 16.0;

    for (int i = 1; i < max_iter; ++i) {
      if (i > count) {
        break;
      }
      int lidx = int(ExtractFloat(u_clusterbuffer, numClusters, ${params.clusterWidth}, cidx, i));
      Light light = UnpackLight(lidx);

      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      // blinn
      float specular = 0.0;
      if (lambertTerm > 0.0) {
        vec3 viewDir = normalize(u_cameraPos - position);
        vec3 halfDir = normalize(L + viewDir);
        float specAngle = max(dot(halfDir, normal), 0.0);
        specular = pow(specAngle, shin);
      }

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      fragColor += light.color * specular * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    // vec3 rgb_normal = normal * 0.5 + 0.5;
    // gl_FragColor = vec4(rgb_normal, 1.0);
  }
  `;
}