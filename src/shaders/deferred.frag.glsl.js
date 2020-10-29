export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform sampler2D u_lightbuffer;
  uniform int u_xSlices;
  uniform int u_ySlices;
  uniform int u_zSlices;
  uniform float u_width;
  uniform float u_height;
  uniform float u_far;
  uniform float u_near;
  uniform mat4 u_viewMat;
  uniform int u_clusterWidth;
  uniform int u_clusterHeight;
  uniform mat4 u_viewProjMatInv;
  uniform vec3 u_cameraPos;
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

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

  vec2 signNotZero(vec2 v)
  {
      return vec2((v.x >= 0.0) ? 1.0 : -1.0, (v.y >= 0.0) ? 1.0 : -1.0);
  }


  vec3 decodeNormal(vec2 e)
  {
      vec3 v = vec3(e.x, e.y, 1.0 - abs(e.x) - abs(e.y));
      if (v.z < 0.0) 
      {
          vec2 newV = (1.0 - vec2(abs(v.y), abs(v.x))) * signNotZero(vec2(v));
          v.x = newV.x;
          v.y = newV.y;
      }
      return normalize(v);
  }

  void main() {
    // Normal and Depth
    /*vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec3 normal = vec3(gb0.x, gb0.y, gb0.z);
    float zDepth = gb0.w;*/

    // Optimized Normal and Depth
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec3 normal = decodeNormal(gb0.xy);
    float zDepth = gb0.z;

    // Albedo
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec3 albedo = gb1.rgb;

    // Pos 
    /*vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    vec3 fragPos = gb2.xyz;*/

    // Optimized Pos
    vec2 ndc = vec2(2.0 * v_uv.x - 1.0, 2.0 * v_uv.y - 1.0);
    vec3 fragPos = vec3((u_viewProjMatInv * vec4(ndc * u_far, u_far, u_far)));
    float t = (zDepth - u_cameraPos.z) / (fragPos.z - u_cameraPos.z);
    fragPos = t * fragPos + (1.0 - t) * u_cameraPos;

    // Position
    vec3 cameraSpacePos = (u_viewMat * vec4(fragPos, 1.0)).xyz;
    
    int xIndex = int(gl_FragCoord.x / (u_width / float(u_xSlices)));
    int yIndex = int(gl_FragCoord.y / (u_height / float(u_ySlices)));
    int zIndex = int((-fragPos.z - u_near) / ((u_far - u_near) / float(u_zSlices)));
    
    int clusterIdx = xIndex + yIndex * u_xSlices + zIndex * u_xSlices * u_ySlices;

    int lightNum = int(ExtractFloat(u_clusterbuffer, int(u_clusterWidth), int(u_clusterHeight), clusterIdx, 0));

    vec3 fragColor = vec3(0.0);

    for (int i = 0; i < ${params.numLights}; ++i) {
      if(i >= lightNum)
        break;

      int lightIdx = int(ExtractFloat(u_clusterbuffer, int(u_clusterWidth), int(u_clusterHeight), clusterIdx, i + 1));

      Light light = UnpackLight(lightIdx);
      float lightDistance = distance(light.position, fragPos);
      vec3 L = (light.position - fragPos) / lightDistance;
      vec3 V = normalize(u_cameraPos - fragPos);

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      // Specular
      vec3 halfway = normalize(L + V);
      float specularIntensity = pow(max(dot(normalize(normal), halfway), 0.0), 32.0); 

      fragColor += specularIntensity * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    clamp(fragColor, 0.0, 1.0);

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}