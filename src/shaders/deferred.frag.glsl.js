
export default function (params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_viewProjMatInv;
    uniform float u_cameraNear;
    uniform float u_cameraFar;
    uniform float u_screenH;
    uniform float u_screenW;
    uniform int u_xSlices;
    uniform int u_ySlices;
    uniform int u_zSlices;
    uniform int u_maxLights;
    uniform vec3 u_camPos;

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
    vec3 fragColor = vec3(0.0);

/* /// optimize 1 ///
        vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
        vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
        vec3 albedo = gb1.xyz;
        float v_position_z = gb0[3]; 

        vec3 normal;
        normal.xy = gb0.xy * 2.0 - 1.0;
        normal.z = - sqrt(1.0 - dot(normal.xy, normal.xy));

        vec2 posScreen = vec2(2.0 * v_uv.x - 1.0, 2.0 * v_uv.y - 1.0);
        vec3 posWorld = (u_viewProjMatInv * vec4(posScreen * u_cameraFar,  u_cameraFar,  u_cameraFar)).xyz;
        float t = (v_position_z - u_camPos.z) / (posWorld.z - u_camPos.z);
        posWorld = t * posWorld + (1.0 - t) * u_camPos;
*/

 /// optimize 2 ///
        vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
        vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
        vec3 albedo = gb1.xyz;
        float v_position_z = gb0[3]; 

        vec3 normal;
        normal.xyz = gb0.xyz * 2.0 - 1.0;

        vec2 posScreen = vec2(2.0 * v_uv.x - 1.0, 2.0 * v_uv.y - 1.0);
        vec3 posWorld = (u_viewProjMatInv * vec4(posScreen * u_cameraFar,  u_cameraFar,  u_cameraFar)).xyz;
        float t = (v_position_z - u_camPos.z) / (posWorld.z - u_camPos.z);
        posWorld = t * posWorld + (1.0 - t) * u_camPos;


        vec3 posCamspace = (u_viewMatrix * vec4(posWorld, 1.0)).xyz;
        int clustX = int(gl_FragCoord.x * float(u_xSlices) / u_screenW);
        int clustY = int(gl_FragCoord.y * float(u_ySlices) / u_screenH);
        int clustZ = int((-posCamspace.z - u_cameraNear) * float(u_zSlices) / (u_cameraFar - u_cameraNear));
        int clustIdx = clustX + clustY * u_xSlices + clustZ * u_xSlices * u_ySlices;
        int numClusters = u_xSlices * u_ySlices * u_zSlices;
        int H = int(floor(float(u_maxLights + 1) / 4.0)) + 1;
        float u = float(clustIdx + 1) / float(numClusters + 1);
        int numLights = int(texture2D(u_clusterbuffer, vec2(u, 0.0))[0]);

    for (int i = 1; i < ${params.maxLights}; ++i) {
      if (i > numLights) {
          break;
      }
      float lightIdx = ExtractFloat(u_clusterbuffer, numClusters, H, clustIdx, i);
      Light light = UnpackLight(int(lightIdx));
      float lightDistance = distance(light.position, posWorld);
      vec3 L = (light.position - posWorld) / lightDistance;
      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }
    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    gl_FragColor = vec4(fragColor, 1.0);
/*
    // Toon shading
    float toonStep = 5.0;
    vec3 color = gl_FragColor.xyz * toonStep;
    vec3 colorInt = floor(color);
    vec3 colorFract = fract(color);
    color = smoothstep(0.45, 0.55, colorFract) / toonStep + colorInt / toonStep;

    float Gx = 0.0;
    float Gy = 0.0;
    float stepX = 0.001;
    float stepY = 0.001;
    vec2 index;

    vec3 horizontal[3];
    horizontal[0] = vec3(3.0,  0.0, -3.0);
    horizontal[1] = vec3(10.0, 0.0, -10.0);
    horizontal[2] = vec3(3.0,  0.0, -3.0);

    vec3 vertical[3];
    vertical[0] = vec3(3.0,  10.0,  3.0);
    vertical[1] = vec3(0.0,   0.0,  0.0);
    vertical[2] = vec3(-3.0, -10.0, -3.0);

    for (int i = 0; i < 3; i++)
    {
        for (int j = 0; j < 3; j++)
        {
            index.x = v_uv.x - (1.0 - float(i)) * stepX;
            index.y = v_uv.y - (1.0 - float(j)) * stepY;
            float depth = texture2D(u_gbuffers[0], index)[3];
            Gx = Gx + depth * horizontal[i][j];
            Gy = Gy + depth * vertical[i][j];
        }
    }
    color /= sqrt(Gx * Gx + Gy * Gy);
    gl_FragColor = vec4(color.xyz, 1.0);
 */   
  }
  `;
}
