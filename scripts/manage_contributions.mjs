#!/usr/bin/env node
// Local maintainer CLI: credentials are read from a protected file, never argv.
import {readFile} from 'node:fs/promises';
const [command,id,status,revision,...rest]=process.argv.slice(2);
const base=process.env.DKB_INTAKE_URL??'http://192.168.1.192:3057';
const key=(await readFile(process.env.DKB_MODERATOR_KEY_FILE??'/etc/dental-preview/moderator.key','utf8')).trim();
if(!['list','show','update','comment','redact'].includes(command)||(command!=='list'&&!/^[a-f0-9]{32}$/.test(id??''))){console.error('Usage: list | show ID | update ID STATUS REVISION JSON_FILE\ncomment ID REVISION JSON_FILE\nredact ID REVISION (privacy erasure; also remove applicable backups)\nJSON_FILE: {"note":"reason", "evidence":["https://.../commit/..."]}');process.exit(1);}
const body=command==='update'?{...JSON.parse(await readFile(rest[0],'utf8')),status,revision:Number(revision)}:command==='comment'?{...JSON.parse(await readFile(revision,'utf8')),revision:Number(status)}:command==='redact'?{revision:Number(status)}:undefined;
const response=await fetch(base+'/api/contributions'+(id?'/'+id:'')+(['update','comment'].includes(command)?'/events':command==='redact'?'/redact':''),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json','X-DKB-Request':'1'}:{})},...(body?{body:JSON.stringify(body)}:{})});
console.log(JSON.stringify(await response.json(),null,2));if(!response.ok)process.exitCode=1;
