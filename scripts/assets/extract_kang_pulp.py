#!/usr/bin/env python3
"""Tessellate only allowlisted CC BY research CAD into an external review directory.
Runtime dependency: isolated cadquery-ocp==8.0.1.0.0, numpy. No clinical volumes.
Usage: python extract_kang_pulp.py SOURCE_ZIP OUTPUT_DIRECTORY
"""
import argparse, hashlib, json, tempfile, zipfile, re, math
from pathlib import Path
import numpy as np
import OCP
from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRep import BRep_Tool
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopoDS import TopoDS
from OCP.TopLoc import TopLoc_Location

p=argparse.ArgumentParser();p.add_argument('archive',type=Path);p.add_argument('output',type=Path);args=p.parse_args()
repo=Path(__file__).resolve().parents[2]
if args.output.resolve().is_relative_to(repo):raise SystemExit('Research assets must remain outside Git until release review')
expected='b65d9f1c13cd6758b18d4bb7630763390285460ccb262baf765edc329de4ec46'
if hashlib.sha256(args.archive.read_bytes()).hexdigest()!=expected:raise SystemExit('Unexpected archive version')
args.output.mkdir(parents=True,exist_ok=True)
manifest={'format':'dkb-research-mesh-v1','id':'kang-2024-pulp-v1','source':'https://doi.org/10.6084/m9.figshare.24591537.v1','article':'https://doi.org/10.7717/peerj.17456','license':'CC-BY-4.0','author':'Fang Fang Kang','archiveSha256':expected,'units':'mm','ocpVersion':OCP.__version__,'linearDeflectionMm':.025,'angularDeflectionRadians':.4,'weldDecimals':6,'reviewStatus':'pending-human-academic-and-release-review','clinicalMeasurement':False,'registrationToWholeMouth':False,'processing':'STEP tessellation and coordinate welding only; source assembly coordinates retained. No smoothing, inferred tissue, root rescaling or clinical segmentation. Normals derived from triangles.','limitations':['Reconstructed research CAD based on pediatric imaging; not an adult reference or an unmodified child specimen.','No independent enamel/dentin, nerve/vessel network, or full canal branch/apical-foramen representation.','PDL is a constructed layer; paper reports 0.15 mm in methods and 0.2 mm in discussion. No precise thickness claim.','Model and source coordinates do not establish anatomical section orientation.'],'models':[]}
with zipfile.ZipFile(args.archive) as archive, tempfile.TemporaryDirectory(prefix='dkb-cad-') as temp:
 for name,filename,label in [('tooth','46.stp','Dişin dış yüzeyi'),('pulp','牙髓腔.stp','Pulpa boşluğu ve kanal biçimi'),('pdl','牙周膜.stp','Şematik periodontal destek katmanı')]:
  raw=archive.read(filename);assert re.search(rb'SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)',raw), 'Expected source millimetres';source=Path(temp)/filename;source.write_bytes(raw)
  reader=STEPControl_Reader();assert reader.ReadFile(str(source))==IFSelect_RetDone;reader.TransferRoots();shape=reader.OneShape();assert BRepCheck_Analyzer(shape).IsValid()
  BRepMesh_IncrementalMesh(shape,.025,False,.4,False).Perform()
  mass=GProp_GProps();BRepGProp.VolumeProperties_s(shape,mass);cad_volume=mass.Mass()
  max_weld=0.0
  vertices=[];triangles=[];lookup={};explorer=TopExp_Explorer(shape,TopAbs_FACE)
  while explorer.More():
   face=TopoDS.Face(explorer.Current());location=TopLoc_Location();mesh=BRep_Tool.Triangulation_s(face,location);assert mesh is not None
   transform=location.Transformation();indices={}
   for i in range(1,mesh.NbNodes()+1):
    v=mesh.Node(i).Transformed(transform);point=(v.X(),v.Y(),v.Z());key=tuple(round(x,6) for x in point)
    if key not in lookup:lookup[key]=len(vertices);vertices.append(point)
    max_weld=max(max_weld,math.dist(vertices[lookup[key]],point))
    indices[i]=lookup[key]
   for i in range(1,mesh.NbTriangles()+1):
    a,b,c=mesh.Triangle(i).Get();tri=[indices[a],indices[b],indices[c]]
    if face.Orientation()==TopAbs_REVERSED:tri.reverse()
    if len(set(tri))==3:triangles.append(tri)
   explorer.Next()
  original=np.asarray(vertices,dtype=np.float64);positions=original.astype('<f4');faces=np.asarray(triangles,dtype='<u4')
  edges=np.sort(np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]),axis=1);_,counts=np.unique(edges,axis=0,return_counts=True)
  normals=np.zeros_like(original);cross=np.cross(original[faces[:,1]]-original[faces[:,0]],original[faces[:,2]]-original[faces[:,0]])
  for i in range(3):np.add.at(normals,faces[:,i],cross)
  length=np.linalg.norm(normals,axis=1);normals/=np.maximum(length[:,None],1e-20)
  mesh_volume=float(np.einsum('ij,ij->i',original[faces[:,0]],np.cross(original[faces[:,1]],original[faces[:,2]])).sum()/6)
  parent=np.arange(len(vertices));
  def root(i):
   while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
   return i
  for a,b,c in faces:
   ra,rb,rc=root(a),root(b),root(c);parent[rb]=ra;parent[rc]=ra
  components=len({int(root(i)) for i in range(len(vertices))})
  packed=positions.tobytes()+normals.astype('<f4').tobytes()+faces.tobytes();(args.output/(name+'.bin')).write_bytes(packed)
  info={'id':name,'label':label,'sourceFile':filename,'sourceSha256':hashlib.sha256(raw).hexdigest(),'file':name+'.bin','sha256':hashlib.sha256(packed).hexdigest(),'vertices':len(vertices),'triangles':len(triangles),'positionsBytes':positions.nbytes,'normalsBytes':positions.nbytes,'indicesBytes':faces.nbytes,'bounds':[original.min(axis=0).tolist(),original.max(axis=0).tolist()],'openEdges':int(np.sum(counts==1)),'nonManifoldEdges':int(np.sum(counts>2)),'maxFloat32ErrorMm':float(np.abs(original-positions).max()),'cadVolumeMm3':cad_volume,'meshSignedVolumeMm3':mesh_volume,'relativeVolumeDeviation':abs(mesh_volume-cad_volume)/abs(cad_volume),'connectedComponents':components,'maxWeldDisplacementMm':max_weld,'zeroAreaTriangles':int(np.sum(np.linalg.norm(cross,axis=1)<1e-12))}
  manifest['models'].append(info);print(json.dumps(info),flush=True)
(args.output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(args.output/'ATTRIBUTION.txt').write_text('Fang Fang Kang (2024), models.zip, version 1. https://doi.org/10.6084/m9.figshare.24591537.v1\nRelated article: Shi H, Kang FF, Liu Q (2024), PeerJ 12:e17456. https://doi.org/10.7717/peerj.17456\nLicense: Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/\nDentalKnowledgeBase changes: allowlisted STEP tessellation, welded coordinates, computed normals, Float32 browser packaging and display materials. Source coordinates retained; no anatomical corrections or source endorsement claimed.\nResearch preview; human academic/release review pending. See manifest for exact hashes, conversion parameters and limitations.\n')
