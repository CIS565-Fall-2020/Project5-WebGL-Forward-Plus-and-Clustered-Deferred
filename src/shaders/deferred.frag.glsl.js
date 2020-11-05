export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform vec3 u_cameraPos;
  uniform float u_farClip;
  uniform float u_nearClip;
  uniform vec2 u_resolution;
  uniform mat4 u_viewProjectionMatrix;

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

  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    vec3 albedo = (gb0).xyz;

    vec3 normal = vec3(0.0);
    normal.x = gb0.w;
    normal.y = gb1.w;
    normal.z = sqrt(1.0 - normal.x * normal.x - normal.y * normal.y);

    vec4 v_positionV4 = vec4(gb1.xyz, 1.0);

    vec3 v_position = v_positionV4.xyz;
    vec3 v_positionNonNDC = (u_viewProjectionMatrix * v_positionV4).xyz;
    vec3 fragColor = vec3(0.0);

    int frustumX = int(gl_FragCoord.x / u_resolution[0] * float(${params.numXSlices}));
    int frustumY = int(gl_FragCoord.y / u_resolution[1] * float(${params.numYSlices}));
    int frustumZ = int((v_positionNonNDC.z - u_nearClip) / (u_farClip - u_nearClip) * float(${params.numZSlices}));
    int frustumIndex = frustumX + frustumY * ${params.numXSlices} + frustumZ * ${params.numXSlices} * ${params.numYSlices};
    int numLightsInfluenceFrustum = int(ExtractFloat(u_clusterbuffer, ${params.numFrustums}, ${params.clusterBufferTextureHeight}, frustumIndex, 0));

    vec3 viewDir = normalize(u_cameraPos - v_position);

    for (int i = 1; i < ${params.numLights}; ++i) {
      if (i > numLightsInfluenceFrustum) {
        break;
      }
      int lightIndex = int(ExtractFloat(u_clusterbuffer, ${params.numFrustums}, ${params.clusterBufferTextureHeight}, frustumIndex, i));
      Light light = UnpackLight(lightIndex);
      
      vec3 lightDir = normalize(light.position - v_position);

      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      vec3 halfwayDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfwayDir), 0.0), 16.0);

      fragColor += albedo * (lambertTerm + spec) * light.color * vec3(lightIntensity);
    }
    
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}