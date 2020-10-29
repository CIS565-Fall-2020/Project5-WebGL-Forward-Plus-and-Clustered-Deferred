export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform vec3 u_camerapos;


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


    // gl_FragColor = col; 
    float fragX = gl_FragCoord.x / float(${params.width});
    float fragY = gl_FragCoord.y/ float(${params.height});
    float fragZ = texture2D(u_gbuffers[0], v_uv).w / 255.0;

    int dimX = int(fragX * float(${params.xSlices}));
    int dimY = int(fragY * float(${params.ySlices}));
    int dimZ = int(fragZ * float(${params.zSlices}));
    int bufIdx = dimX + dimY * ${params.xSlices} + dimZ * ${params.xSlices} * ${params.ySlices};

    float n_lights = ExtractFloat(u_clusterbuffer, ${params.xSlices * params.ySlices * params.zSlices}, int(${Math.ceil((params.numLights + 1)/4)}), bufIdx, 0);

    vec3 albedo = texture2D(u_gbuffers[1], v_uv).rgb / 255.0;
    vec3 normal = texture2D(u_gbuffers[0], v_uv).xyz / 255.0;
    vec3 v_position = texture2D(u_gbuffers[2], v_uv).xyz / 255.0;

    vec3 fragColor = vec3(0.0);

    float u = float(bufIdx + 1) / float(${params.xSlices * params.ySlices * params.zSlices} + 1);
    int pixel = (0+1) / 4;
    float v = float(pixel + 1) / float(int(${Math.ceil((params.numLights + 1)/4)} + 1));
    vec4 bufferValue = texture2D(u_clusterbuffer, vec2(u, v));

    for (int i = 0; i < ${params.numLights}; i++) {
      if (i >= int(n_lights)) { break; }
      
      if (int((i+1) / 4)*4 == i+1) {
        u = float(bufIdx + 1) / float(${params.xSlices * params.ySlices * params.zSlices} + 1);
        pixel = (i+1) / 4;
        v = float(pixel + 1) / float(int(${Math.ceil((params.numLights + 1)/4)} + 1));
        bufferValue = texture2D(u_clusterbuffer, vec2(u, v));
      }
      int lightIdx = int(bufferValue[(i+1)-(4*int((i+1)/4))]);
      
      Light light = UnpackLight(lightIdx);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;
      // vec3 H = normalize(light.position + u_camerapos);
      // float specularTerm = max(dot(H, normal), 0.0);
      // specularTerm = specularTerm * specularTerm;
      // specularTerm = specularTerm * specularTerm * specularTerm;
      
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      // fragColor += 1.0 * specularTerm * vec3(1,1,1) * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}