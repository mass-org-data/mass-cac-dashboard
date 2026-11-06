// Preserve psql's per-statement autocommit semantics in the portable SQL runner.
// Quoted function bodies, escaped strings and comments may contain semicolons.
export function sqlStatements(sql) {
 const result=[];let start=0,i=0,quote='',dollar='',comment=0,line=false;
 while(i<sql.length){
  const c=sql[i],next=sql[i+1];
  if(line){if(c==='\n')line=false;i++;continue;}
  if(comment){if(c==='/'&&next==='*'){comment++;i+=2;}else if(c==='*'&&next==='/'){comment--;i+=2;}else i++;continue;}
  if(dollar){if(sql.startsWith(dollar,i)){i+=dollar.length;dollar='';}else i++;continue;}
  if(quote){if(c===quote){if(next===quote)i+=2;else{quote='';i++;}}else if(c==='\\'&&quote==="'")i+=2;else i++;continue;}
  if(c==='-'&&next==='-'){line=true;i+=2;continue;}
  if(c==='/'&&next==='*'){comment=1;i+=2;continue;}
  if(c==="'"||c==='"'){quote=c;i++;continue;}
  if(c==='$'){const match=sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z_0-9]*)?\$/);if(match){dollar=match[0];i+=dollar.length;continue;}}
  if(c===';'){result.push(sql.slice(start,i+1));start=i+1;}i++;
 }
 if(quote||dollar||comment)throw Error('Unclosed SQL quote or comment in test fixture');
 if(sql.slice(start).trim())result.push(sql.slice(start));
 return result;
}
export async function runSqlScript(db,sql){const results=[];for(const statement of sqlStatements(sql))results.push(...await db.exec(statement));return results;}
