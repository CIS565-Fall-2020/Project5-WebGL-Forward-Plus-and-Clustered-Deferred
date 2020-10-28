export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_colmap;
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform mat4 u_viewMatrix;
  uniform int u_screenWidth;
  uniform int u_screenHeight;
  uniform float u_cameraFar;
  uniform float u_cameraNear;
  uniform vec3 u_slices;
  
  varying vec2 v_uv;

  // copy helper functions from forward plus
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

  // helper function to help us unpack a vec2 normal into a vec3 normal
  vec3 unpack(vec2 p) {
    p = p * 2.0 - 1.0;
    vec3 nor = vec3(p.x, p.y, 1.0 - abs(p.x) - abs(p.y));
    float t = clamp(-nor.z, 0.0, 1.0);
    if (nor.x >= 0.0) {
      nor.x += -t;
    } else {
      nor.x += t;
    }
    if (nor.y >= 0.0) {
      nor.y += -t;
    } else {
      nor.y += t;
    }
    return normalize(nor);
  }

  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    // extract data from gbuffers
    vec3 pos = gb0.rgb;
    vec3 col = vec3(gb0[3], gb1[0], gb1[1]);
    vec3 nor = unpack(vec2(gb1[2], gb1[3]));

    // get the camera space of the frag
    vec4 camera_space = u_viewMatrix * vec4(pos, 1.0);
    camera_space.z *= -1.0;

    // caluclate teh idx of current cluster of frag
    float x_dim = float(u_screenWidth) / u_slices[0];
    float y_dim = float(u_screenHeight) / u_slices[1];
    float z_dim = float(u_cameraFar - u_cameraNear) / u_slices[2];

    int x_idx = int(gl_FragCoord.x / x_dim);
    int y_idx = int(gl_FragCoord.y / y_dim);
    int z_idx = int((camera_space.z - u_cameraNear) / z_dim);

    int idx = x_idx + y_idx * int(u_slices[0]) + z_idx * int(u_slices[0]) * int(u_slices[1]);

    // get number of lights from texture
    int texture_h = int(ceil(float(${params.maxLightsPerCluster} + 1) / 4.0));
    int cluster_num = int(u_slices[0] * u_slices[1] * u_slices[2]);
    int lights_num = int(texture2D(u_clusterbuffer, 
                                   vec2(float(idx + 1) / float(cluster_num + 1), 0)).r);

    vec3 fragColor = vec3(0.0);
    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i < lights_num) {
        // calculate the light idx from the texture
        int light_idx = int(ExtractFloat(u_clusterbuffer, cluster_num, texture_h, idx, i + 1));
        Light light = UnpackLight(light_idx);
        float lightDistance = distance(light.position, pos);
        vec3 L = (light.position - pos) / lightDistance;

        float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
        float lambertTerm = max(dot(L, nor), 0.0);

        fragColor += col * lambertTerm * light.color * vec3(lightIntensity);
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += col * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}