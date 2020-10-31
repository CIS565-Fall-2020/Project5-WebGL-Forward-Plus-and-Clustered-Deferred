export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewMatrix;
  uniform float u_nearClip;
  uniform float u_farClip;
  uniform ivec3 u_slices;
  uniform vec2 u_dimensions;
  uniform int u_maxNumLightsPlusOne;
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
    // TODO: extract data from g buffers and do lighting
    vec3 position = texture2D(u_gbuffers[0], v_uv).xyz;
    //vec3 normal = texture2D(u_gbuffers[1], v_uv).xyz;
    vec3 albedo = texture2D(u_gbuffers[1], v_uv).xyz;
/*
    float n1 = texture2D(u_gbuffers[0], v_uv).w;
    float n2 = texture2D(u_gbuffers[1], v_uv).w;
    float a = n1 - n2;
    float b = n1 + n2;
    float n3 = sqrt(1.0 - a * a - b * b);
    vec3 normal = vec3(n1, n2, n3);
*/
    vec3 normal = texture2D(u_gbuffers[2], v_uv).xyz;


    vec3 fragColor = vec3(0.0);

    int x_slices = u_slices.x;
    int y_slices = u_slices.y;
    int z_slices = u_slices.z;

    vec3 view_pos = (u_viewMatrix * vec4(position, 1.0)).xyz;
    int z_index = int((abs(view_pos.z) - u_nearClip) * float(z_slices) / (1.0 * u_farClip - 1.0 * u_nearClip));
    int x_index = int(floor((float(gl_FragCoord.x) / u_dimensions.x * float(x_slices))));
    int y_index = int(floor((float(gl_FragCoord.y) / u_dimensions.y * float(y_slices))));


    int index = x_index + y_index * x_slices + z_index * x_slices * y_slices;
    int num_clusters = x_slices * y_slices * z_slices;
    int texture_height = int(float(u_maxNumLightsPlusOne) / 4.0) + 1;

    int num_lights = int(ExtractFloat(u_clusterbuffer, num_clusters, texture_height, index, 0));

    
    for (int i = 0; i < ${params.numLights}; ++i) {
      
      if(i >= num_lights) {
        break;
      }
      int l = int(ExtractFloat(u_clusterbuffer, num_clusters, texture_height, index, i + 1));

      Light light = UnpackLight(l);
      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;
      vec3 C = (u_camPos - position) / distance(u_camPos, position);
      vec3 H = (L + C) / 2.0;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      float dotProduct = abs(dot(normalize(H), normal));
      float dotMax = pow(dotProduct, 50.0);
      float spectacularIntensity = max(dotMax, 0.0);

      fragColor += albedo * (lambertTerm + spectacularIntensity)  * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    //fragColor = vec3(ss, 0.0, 0.0);
    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}