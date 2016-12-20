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
    //console.log(document.getElementById("fileToLoad").files);
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
        var info=document.getElementById("information");
        info.innerHTML= "Error"; 
    };
    var fileReader = new FileReader();
    
	fileReader.onload = function(fileLoadedEvent) 
	{
        var loader = new THREE.SubDOBJLoader(manager);
        subd = loader.parse(fileLoadedEvent.target.result);
       // if(isQuadMesh(subd)){ 
            fitSubD(subd,2);
            controlMesh=subd;
            infovf.innerHTML="Vertices: "+subd.verts.length + "<br>" + "Faces: " + subd.faces.length;
            hemesh=new Hemesh();
            var hem=hemesh.fromFaceVertexArray(subd.faces,subd.verts);
            var hew=hewireframe.fromFaceVertexArray(subd.faces,subd.verts);
            //hemesh.normalize();
            //hewireframe.normalize();
            if(hem===undefined && hew===undefined){
                hemesh.triangulate();
                var wireframeLines = hewireframe.toWireframeGeometry();
                controlMeshObject = new THREE.LineSegments(wireframeLines,controlMeshMaterial);
                var geo = hemesh.toGeometry();
                //geo.computeVertexNormals()
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
                if(!isQuadMesh(subd) && info.innerHTML!=="" ) info.innerHTML+= "<br> Warning: Control Mesh is not quad-based";   
                if(!isQuadMesh(subd) && info.innerHTML==="" ) info.innerHTML= "Warning: Control Mesh is not quad-based";   
                
            }
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
function subdivideFunction(){
    var mesh=setup.scene.getObjectByName("meshLimit");
    if (mesh) {
        subdMesh = subd;
        subdMesh = subdMesh.smooth();
        //subdMesh.calculateNormals();
        renderToScene(subdMesh);
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
function resetSubdivision(){
    var mesh=setup.scene.getObjectByName("meshLimit");
    if(mesh){
        subd=controlMesh;
        renderToScene(subd);  
    }
}
d3.select("#fileToLoad").on("change",loadFileAsText);
d3.select("#exportButton").on("click",toOBJ);
d3.select("#diButton").on("click",subdivideFunction);
d3.select("#checkRender").on("click",phongRender);
d3.select("#checkCM").on("click",showControlMesh);
d3.select("#oriButton").on("click",resetSubdivision);
d3.select("#checkWireframe").on("click",showWireframe);
loadServerModel("models/head.obj");
