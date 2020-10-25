export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform int u_x_slices_num;
  uniform int u_y_slices_num;
  uniform int u_z_slices_num;
  uniform mat4 u_inv_view_mat;
  uniform mat4 u_inv_view_proj_mat;
  uniform int u_max_light_cluster;
  uniform float u_canvas_height;
  uniform float u_canvas_width;
  uniform float u_cam_near;
  uniform float u_cam_far;
  uniform vec3 u_cam_pos;

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

  int UnpackClusterBuffer(int cluster_idx, int inner_idx, int clusters_num){
    float u = float(cluster_idx + 1) / float(clusters_num + 1);
    int cluster_texture_dim = int(ceil(float(u_max_light_cluster + 1) / 4.0));
    return int(ExtractFloat(u_clusterbuffer, clusters_num, cluster_texture_dim, cluster_idx, inner_idx));
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

    vec3 pos = gb0.rgb;
    vec3 albedo = gb1.rgb;
    vec2 encoded_normal = vec2(gb0[3], gb1[3]);
    float PI = 3.1415926;
    // Spherical Coordinates decode
    vec2 ang = encoded_normal * 2.0 - 1.0;
    vec2 scth = vec2(sin(ang.x * PI), cos(ang.x * PI));
    vec2 scphi = vec2(sqrt(1.0 - ang.y*ang.y), ang.y);
    vec3 decoded_normal = vec3(scth.y*scphi.x, scth.x*scphi.x, scphi.y);
    vec3 normal = decoded_normal;

    vec3 fragColor = vec3(0.0);

    // Reconstruct the cluster index for this fragment
    vec4 camera_space_pos = u_inv_view_mat * vec4(pos.xyz, 1.0);

    int x_slice_idx = int(float(u_x_slices_num) * gl_FragCoord.x / u_canvas_width);
    int y_slice_idx = int(float(u_y_slices_num) * gl_FragCoord.y / u_canvas_height);
    int z_slice_idx = int(float(u_z_slices_num) * (-camera_space_pos.z - u_cam_near) / (u_cam_far - u_cam_near));

    int curr_frag_cluster_idx = x_slice_idx + u_x_slices_num * y_slice_idx + z_slice_idx * u_x_slices_num * u_y_slices_num;
    int clusters_num = u_x_slices_num * u_y_slices_num * u_z_slices_num;
    int curr_cluster_lights_num = UnpackClusterBuffer(curr_frag_cluster_idx, 0, clusters_num);

    for (int i = 0; i < ${params.maxLightsInCluster}; ++i) {
      if(i >= curr_cluster_lights_num){
        break;
      }
      int light_idx = UnpackClusterBuffer(curr_frag_cluster_idx, i + 1, clusters_num);
      Light light = UnpackLight(light_idx);
      float lightDistance = distance(light.position, pos);
      vec3 L = (light.position - pos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      
      // Specular term (Blinn-Phong)
      vec3 view_vector = normalize(u_cam_pos - vec3(pos.xyz));
      vec3 half_vector = normalize(L + view_vector);
      float blinn_phong_term = pow(max(dot(normalize(normal), half_vector), 0.0), 10.0); 

      // fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      fragColor += albedo * (lambertTerm + blinn_phong_term) * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}