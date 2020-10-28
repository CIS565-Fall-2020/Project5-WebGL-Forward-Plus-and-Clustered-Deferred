#version 310 es
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

in vec3 v_position;
in vec3 v_normal;
in vec2 v_uv;

layout (location = 0) out vec3 fragNormal;
layout (location = 1) out vec3 fragAlbedo;
layout (location = 2) out vec3 fragStuff;
layout (location = 3) out vec3 fragStuff2;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

void main() {
    fragNormal = applyNormalMap(v_normal, vec3(texture(u_normap, v_uv)));
    fragAlbedo = vec3(texture(u_colmap, v_uv));
    fragStuff = vec3(v_position);
    fragStuff2 = vec3(1.0f);
}
