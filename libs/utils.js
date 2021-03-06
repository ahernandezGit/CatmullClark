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
function renderToScene(subdStructure){
        infovf.innerHTML="Vertices: "+subdStructure.verts.length + "<br>" + "Faces: " + subdStructure.faces.length;
        hemesh=new Hemesh();
        hewireframe=new Hemesh();
        var hem=hemesh.fromFaceVertexArray(subdStructure.faces,subdStructure.verts);
        var hew=hewireframe.fromFaceVertexArray(subdStructure.faces,subdStructure.verts);
        //hemesh.normalize();
        //hewireframe.normalize();
        if(hem===undefined && hew===undefined){
            hemesh.triangulate();
            var wireframeLines = hewireframe.toWireframeGeometry();
            var wireframe = new THREE.LineSegments(wireframeLines, new THREE.LineBasicMaterial({
                color: 0xff2222,
                opacity: 0.2,
                transparent: true,
            }));
            var geo = hemesh.toGeometry();
            geo.computeVertexNormals();
            if(document.getElementById("checkRender").checked) var mesh = new THREE.Mesh(geo, phongmaterial);
            else var mesh = new THREE.Mesh(geo, meshmaterial);
            var meshl=setup.scene.getObjectByName("meshLimit");
            var wire=setup.scene.getObjectByName("wireframe");
            if(mesh!==undefined) setup.scene.remove(meshl);
            if(wire!==undefined) setup.scene.remove(wire);
            wireframe.name="wireframe";
            mesh.name="meshLimit";
            setup.scene.add(mesh);
            setup.scene.add(wireframe);
            if(!document.getElementById("checkWireframe").checked) wireframe.visible=false;
        }
}
function loadServerModel(url) {
    clear();
    var manager = new THREE.LoadingManager();
    manager.onProgress =function ( xhr ) {
        if ( xhr.lengthComputable ) {
            var percentComplete = xhr.loaded / xhr.total * 100;
            var info=document.getElementById("information");
            info.innerHTML= Math.round(percentComplete, 2) + '% downloaded'; 
            //console.log( Math.round(percentComplete, 2) + '% downloaded' );
        }
    };
    manager.onError=function ( xhr ) {
        console.log("error");
        info.innerHTML= "Error"; 
    };
    var loader = new THREE.SubDOBJLoader(manager);
    loader.load(url, function(structure) {
        subd=structure;
        fitSubD(subd,2);
        controlMesh=subd;
        renderToScene(subd);
        var wireframeLines = hewireframe.toWireframeGeometry();
        controlMeshObject = new THREE.LineSegments(wireframeLines,controlMeshMaterial);
        controlMeshObject.name="controlMesh";
        setup.scene.add(controlMeshObject); 
        if(!isQuadMesh(subd) && info.innerHTML!=="" ) info.innerHTML+= "<br> Warning: Control Mesh is not quad-based"; 
        if(!isQuadMesh(subd) && info.innerHTML==="" ) info.innerHTML= "Warning: Control Mesh is not quad-based";   
    });			
}
