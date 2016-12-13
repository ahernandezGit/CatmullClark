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
        document.body.appendChild(downloadLink);
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
	var fileToLoad = document.getElementById("fileToLoad").files[0];
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
    var fileReader = new FileReader();
    
	fileReader.onload = function(fileLoadedEvent) 
	{
        var loader = new THREE.SubDOBJLoader(manager);
        subd = loader.parse(fileLoadedEvent.target.result);
        fitSubD(subd,2);
        hemesh=new Hemesh();
        hemesh.fromFaceVertexArray(subd.faces,subd.verts);
        hewireframe.fromFaceVertexArray(subd.faces,subd.verts);
        //hemesh.normalize();
        //hewireframe.normalize();
        hemesh.triangulate();
        var wireframeLines = hewireframe.toWireframeGeometry();
        var wireframe = new THREE.LineSegments(wireframeLines, new THREE.LineBasicMaterial({
            color: 0xff2222,
            opacity: 1,
            transparent: true,
        }));
        var geo = hemesh.toGeometry();
        var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color:  0xd9d9d9,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            side:  THREE.DoubleSide, 
            vertexColors: THREE.FaceColors,
            polygonOffsetUnits: 0.1,
            opacity: 1,
            transparent: true
        }));
        setup.scene.add(mesh);
        wireframe.name="wireframe";
        mesh.name="meshLimit";
        setup.scene.add(wireframe);
    };
  
    fileReader.readAsText(fileToLoad);
}

function toOBJ(){
   var mesh=setup.scene.getObjectByName("meshLimit");
   if(mesh!==undefined){    
       //var result = exporter.parse(mesh );
       var result=hewireframe.toOBJ();
       saveTextAsFile(result);
       console.log("hola");
   }
   else{
       console.log("no object");
   }
}

function backMesh(){
    var mesh=setup.scene.getObjectByName("ImportedMesh");
    var n=mesh.geometry.vertices.length;
    for(var i=0;i<n;i++){
        mesh.geometry.vertices[i].set(vx[i],vy[i],vz[i]);
    }
    mesh.geometry.verticesNeedUpdate=true;
    isSmooth=false;
}
function subdivideFunction(){
    if (subd) {
        subdMesh = subd;
        subdMesh = subdMesh.smooth();
        subdMesh.calculateNormals();
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
            opacity: 1,
            transparent: true,
        }));
        var geo = hemesh.toGeometry();
        var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color:  0xd9d9d9,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            side:  THREE.DoubleSide, 
            vertexColors: THREE.FaceColors,
            polygonOffsetUnits: 0.1,
            opacity: 1,
            transparent: true
        }));
        var meshl=setup.scene.getObjectByName("meshLimit");
        var wire=setup.scene.getObjectByName("wireframe");
        if(mesh!==undefined) setup.scene.remove(meshl);
        if(wire!==undefined) setup.scene.remove(wire);
       
        wireframe.name="wireframe";
        mesh.name="meshLimit";
        setup.scene.add(mesh);
        setup.scene.add(wireframe);
        subd=subdMesh;
   }
       
}
d3.select("#fileToLoad").on("change",loadFileAsText);
d3.select("#exportButton").on("click",toOBJ);
d3.select("#diButton").on("click",subdivideFunction);