function clear(){
    for (var i = setup.scene.children.length - 1; i >= 0 ; i -- ) {
        var obj = setup.scene.children[i];
        if(obj.type!=="DirectionalLight" && obj.type!=="AmbientLight"){
            setup.scene.remove(obj);
            dispose3(obj);   
        }        
    }
    hemesh=new Hemesh();
    hewireframe=new Hemesh();
    subd={};
    subdMesh={};
    controlMeshGeometry={};
    controlMeshObject={};
    info.innerHTML="";
    infovf.innerHTML="";
    console.log("reset all");
}
function mergeMeshes (meshes) {
  var combined = new THREE.Geometry();

  for (var i = 0; i < meshes.length; i++) {
    meshes[i].updateMatrix();
    combined.merge(meshes[i].geometry, meshes[i].matrix);
  }

  return combined;
}
function fitSubD(subd, size) {
        var min = new THREE.Vector3(1000000, 1000000, 1000000);
        var max = new THREE.Vector3(-1000000, -1000000, -1000000);
        var centroid=new THREE.Vector3();
        for (var i = 0; i < subd.verts.length; i++) {
            min.min(subd.verts[i]);
            max.max(subd.verts[i]);
            centroid.add(subd.verts[i]);
        }
        centroid.divideScalar(subd.verts.length);
        var range = new THREE.Vector3().subVectors(max, min);

        var scale;
            scale = size / range.y;
        var offset = new THREE.Vector3(
            (min.x + max.x) * 0.5,
            min.y,
            (min.z + max.z) * 0.5
        );

        for (var i = 0; i < subd.verts.length; i++) {
            subd.verts[i].sub(centroid);
            subd.verts[i].multiplyScalar(scale);
        }
}
function isQuadMesh(subd){
    var n=subd.faces.length;
    for(var i=0;i<n;i++){
        if(subd.faces[i].length!==4){
            return false;
        }
    }
    return true;
}