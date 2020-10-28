#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

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

// helper function to help us pack a vec3 normal into a vec2 normal
vec2 pack(vec3 n) {
    float sum = (abs(n.x) + abs(n.y) + abs(n.z));
    n /= sum;
    vec2 v = n.xy;
    if (n.z >= 0.0) {
        n.xy = v;
    } else {
        n.xy = (1.0 - abs(v.yx)) * vec2(sign(v.x), sign(v.y));
    }
    n.xy = n.xy * 0.5 + 0.5;
    return n.xy;
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    // TODO: populate your g buffer

    vec2 packed_normal = pack(norm);
    gl_FragData[0] = vec4(v_position, col[0]);
    gl_FragData[1] = vec4(col.yz, packed_normal);
     
    // gl_FragData[3] = ??
}