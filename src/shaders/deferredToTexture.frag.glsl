#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

#define TWO_COMPONENT_NORMAL 1

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

#if TWO_COMPONENT_NORMAL == 1
    vec2 tmp = normalize(norm.xy) * (sqrt(-norm.z * 0.5 + 0.5));
    tmp = tmp * 0.5 + 0.5;
    gl_FragData[0] = vec4(col, tmp.x);
    gl_FragData[1] = vec4(v_position, tmp.y);

#else
    gl_FragData[0] = vec4(col, 1.0);
    gl_FragData[1] = vec4(v_position, 1.0);
    gl_FragData[2] = vec4(norm, 0.0);
#endif  // TWO_COMPONENT_NORMAL

}