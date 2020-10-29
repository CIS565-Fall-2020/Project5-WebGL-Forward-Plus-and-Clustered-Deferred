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

  vec3 myreflect(vec3 n, vec3 l){
    vec3 l_x = l - dot(l, n);
    return l - 2.0 * l_x;
  }

  vec3 p2ClusterIdx(vec3 proj_p){
    // get correspoinding cluster idx from projection
    // space position

    // NDC space is [-1, 1]
    // clamp to [0, 2] and mess with slice 
    proj_p += vec3(1.0);
    vec3 size_per_slice =vec3(2.0) / vec3( u_xSlice, u_ySlice, u_zSlice);
    
    return floor(proj_p / size_per_slice);
  }

  

  vec3 shaderLight(
    vec3 albedo, vec3 normal, 
    Light light, float shiness, float k_s,
    vec3 v_position
    ){
      vec3 tmp_frag_color = vec3(0.0);

      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      tmp_frag_color += albedo * lambertTerm * light.color * vec3(lightIntensity);

      // Phong Specular
      vec3 V = normalize( u_view_pos - v_position );
      vec3 H = normalize( L + V );
      vec3 R = normalize(myreflect(normal, light.position - v_position));
      // intensity of specular
      // blinn phong
      float specularTerm = max(dot(H, normal), 0.0);
      // vanilla phong
      //float specularTerm = max(dot(V, R), 0.0);
      float i_s = pow(specularTerm, shiness);

      tmp_frag_color +=  k_s * i_s * light.color * vec3(lightIntensity);
      return tmp_frag_color;
  }