function saveTextAsFile(textToWrite){
	var textFileAsBlob = new Blob([textToWrite], {type:'application/octet-stream'});
	var fileNameToSaveAs = "mesh.obj";
	var downloadLink = document.createElement("a");
	downloadLink.download = fileNameToSaveAs;
	downloadLink.innerHTML = "Download File";
	if (window.URL !== null )
	{
		// Chrome allows the link to be clicked
		// without actually adding it to the DOM.
		downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
        //document.body.appendChild(downloadLink);
        downloadLink.click();
	}
	else{
		// Firefox requires the link to be added to the DOM
		// before it can be clicked.
        //downloadLink.onclick = destroyClickedElement;
        var url= window.URL.createObjectURL(textFileAsBlob);
		downloadLink.href = url;
		downloadLink.style.display = "none";
		document.body.appendChild(downloadLink);
        downloadLink.click();
        setTimeout(function(){
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(url);  
        }, 100);  
	}
}

function loadFileAsText(){
    clear();
    var fileToLoad = document.getElementById("fileToLoad").files[0];
    var manager = new THREE.LoadingManager();
    manager.onProgress =function ( xhr ) {
        if ( xhr.lengthComputable ) {
            var percentComplete = xhr.loaded / xhr.total * 100;
            info.innerHTML= Math.round(percentComplete, 2) + '% downloaded'; 
            //console.log( Math.round(percentComplete, 2) + '% downloaded' );
        }
    };
    var fileReader = new FileReader();
    
	fileReader.onload = function(fileLoadedEvent) 
	{
        var loader = new THREE.SubDOBJLoader(manager);
        subd = loader.parse(fileLoadedEvent.target.result);
       // if(isQuadMesh(subd)){
            infovf.innerHTML="Vertices: "+subd.verts.length + "<br>" + "Faces: " + subd.faces.length;
            fitSubD(subd,2);
            hemesh=new Hemesh();
            hemesh.fromFaceVertexArray(subd.faces,subd.verts);
            hewireframe.fromFaceVertexArray(subd.faces,subd.verts);
            //hemesh.normalize();
            //hewireframe.normalize();
            hemesh.triangulate();
            var wireframeLines = hewireframe.toWireframeGeometry();
            controlWireGeometry=wireframeLines;
            controlMeshObject = new THREE.LineSegments(wireframeLines,controlMeshMaterial);
            var geo = hemesh.toGeometry();
            geo.computeVertexNormals()
            if(document.getElementById("checkRender").checked) var mesh = new THREE.Mesh(geo, phongmaterial);
            else var mesh = new THREE.Mesh(geo, meshmaterial);
            setup.scene.add(mesh);
            controlMeshObject.name="controlMesh";
            mesh.name="meshLimit";
            setup.scene.add(controlMeshObject);    
        /*}
        else{
            info.innerHTML= "Control Mesh is not quad-based";   
        }*/
            if(!isQuadMesh(subd)) info.innerHTML= "Warning: Control Mesh is not quad-based";   
    };
  
    fileReader.readAsText(fileToLoad);
}

function toOBJ(){
   var mesh=setup.scene.getObjectByName("meshLimit");
   if(mesh!==undefined){    
       var result=hewireframe.toOBJ();
       saveTextAsFile(result);
       console.log("hola");
   }
   else{
       console.log("no object");
       info.innerHTML="No mesh";
   }
}

function backMesh(){
    var mesh=setup.scene.getObjectByName("meshLimit");
    var n=mesh.geometry.vertices.length;
    for(var i=0;i<n;i++){
        mesh.geometry.vertices[i].set(vx[i],vy[i],vz[i]);
    }
    mesh.geometry.verticesNeedUpdate=true;
    isSmooth=false;
}
function subdivideFunction(){
    var mesh=setup.scene.getObjectByName("meshLimit");
    if (mesh) {
        subdMesh = subd;
        subdMesh = subdMesh.smooth();
        //subdMesh.calculateNormals();
        infovf.innerHTML="Vertices: "+subdMesh.verts.length + "<br>" + "Faces: " + subdMesh.faces.length;
        hemesh=new Hemesh();
        hewireframe=new Hemesh();
        hemesh.fromFaceVertexArray(subdMesh.faces,subdMesh.verts);
        hewireframe.fromFaceVertexArray(subdMesh.faces,subdMesh.verts);
        //hemesh.normalize();
        //hewireframe.normalize();
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
        subd=subdMesh;
   }
   else{
       info.innerHTML="No mesh";
   }
       
}
function phongRender(){
    var mesh=setup.scene.getObjectByName("meshLimit");
    if(mesh){
        var flag=document.getElementById("checkRender").checked;
        if(flag){
            mesh.material=phongmaterial;
        }
        else{
            mesh.material=meshmaterial;
        }
    }
}
function showControlMesh(){
    var controlmesh=setup.scene.getObjectByName("controlMesh");
    var checkcm=document.getElementById("checkCM");
    if(checkcm.checked){
        if(controlmesh) controlmesh.visible=true;
    }
    else{
        if(controlmesh)  controlmesh.visible=false;
    }
}
function showWireframe(){
    var wireframe=setup.scene.getObjectByName("wireframe");
    var checkcm=document.getElementById("checkWireframe");
    if(checkcm.checked){
        if(wireframe) wireframe.visible=true;
    }
    else{
        if(wireframe) wireframe.visible=false;
    }
}

d3.select("#fileToLoad").on("change",loadFileAsText);
d3.select("#exportButton").on("click",toOBJ);
d3.select("#diButton").on("click",subdivideFunction);
d3.select("#checkRender").on("click",phongRender);
d3.select("#checkCM").on("click",showControlMesh);
d3.select("#checkWireframe").on("click",showWireframe);