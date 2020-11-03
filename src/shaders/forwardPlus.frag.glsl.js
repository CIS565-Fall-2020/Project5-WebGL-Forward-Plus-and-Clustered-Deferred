export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform float u_width;
  uniform float u_height;
  uniform float u_far_clip;
  uniform float u_near_clip;
  uniform int u_num_clusters;
  uniform int u_max_lights;
  uniform mat4 u_viewProjectionMatrix;
  uniform mat4 u_viewMatrix;

  varying vec3 v_position;
  varying vec3 v_normal;
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
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    // ***** get the cluster ******
    // get the x and y
    int x = int(gl_FragCoord.x / (float(u_width) / float(${params.xSlices}))); 
    int y = int(gl_FragCoord.y / (float(u_height) / float(${params.ySlices}))); 

    // get the z
    vec4 world_pt = u_viewMatrix * vec4(v_position, 1.0); // to camera space
    float dist = float(u_far_clip) - float(u_near_clip);
    float z_ratio = (float(int(abs(world_pt[2]))) - float(u_near_clip)) / dist;
    int z = int(float(${params.zSlices}) * z_ratio);

    // get cluster index
    int cluster_index = x + (y * ${params.xSlices}) + (z * ${params.xSlices} * ${params.ySlices});
    float cluster_u = float(cluster_index + 1) / float(${params.xSlices} * ${params.ySlices} * ${params.zSlices} + 1);
    int numLightsInCluster = int(texture2D(u_clusterbuffer, vec2(cluster_u, 0.0))[0]);
    float cluster_v_step = 1.0 / (floor((float(u_max_lights) + 1.0) * 0.25) + 1.0);
    int offset = 1;

    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i >= numLightsInCluster) {
        break;
      }

      // get index of light
      float cluster_v = (floor(float(i + 1) * 0.25) + 1.0) * cluster_v_step;
      int lightIndex = 0;
      if (offset == 0) {lightIndex = int(texture2D(u_clusterbuffer, vec2(cluster_u, cluster_v))[0]);}
      else if (offset == 1) {lightIndex = int(texture2D(u_clusterbuffer, vec2(cluster_u, cluster_v))[1]);}
      else if (offset == 2) {lightIndex = int(texture2D(u_clusterbuffer, vec2(cluster_u, cluster_v))[2]);}
      else if (offset == 3) {lightIndex = int(texture2D(u_clusterbuffer, vec2(cluster_u, cluster_v))[3]);}
      
      offset++;
      if (offset >= 4) {
        offset = 0;
      }

      Light light = UnpackLight(lightIndex);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }
    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
