import importlib.util, tempfile, unittest
from pathlib import Path
from openpyxl import Workbook
spec=importlib.util.spec_from_file_location('reconcile',Path(__file__).resolve().parents[2]/'scripts/directory/reconcile.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Reconciliation(unittest.TestCase):
 def fixture(self,path):
  book=Workbook();book.remove(book.active)
  mapping={}
  for title in m.SHEETS:
   s=book.create_sheet(title);s.append(['Centre','Region','Teacher','Officer','Shift']);s.append(['Synthetic village','Region A','Synthetic staff','Synthetic officer','Morning'])
   mapping[title]={'header_row':1,'verified_donor_label':f'Synthetic {title}','columns':dict(centre='A',region='B',teacher='C',officer='D',shift='E'),'verified_headers':dict(centre='Centre',region='Region',teacher='Teacher',officer='Officer',shift='Shift')}
  s=book['Janashkati Foundation'];s.append([' Masaraguppi ','Region A','Synthetic same','Synthetic officer','Morning']);s.append(['Masaraguppi','Region B','Synthetic same','Synthetic officer','Evening']);s.append(['Masaraguppi','Region B','Synthetic same','Synthetic officer','Evening']);book.save(path);return mapping
 def test_collisions_preserve_originals_and_provenance(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp)/'synthetic.xlsx';mapping=self.fixture(p);result=m.reconcile(p,mapping)
   self.assertEqual(result['summary']['row_count'],8)
   self.assertEqual(result['summary']['issue_counts']['masaraguppi_explicit_review_required'],3)
   self.assertEqual(result['summary']['issue_counts']['duplicate_source_row'],2)
   self.assertTrue(result['summary']['issue_counts']['possible_multiple_donor_association']>0)
   row=result['rows'][4];self.assertIn('source_sha256',row);self.assertIn('row_number',row)
   self.assertTrue(any(r['raw']['centre']==' Masaraguppi ' and r['normalized']['centre']=='Masaraguppi' for r in result['rows']))
   self.assertEqual(m.reconcile(p,mapping),result) # Deterministic review/retry, no UUID/name merge.
 def test_header_drift_fails_closed(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp)/'synthetic.xlsx';mapping=self.fixture(p);mapping['Mpokket']['verified_headers']['centre']='Wrong'
   with self.assertRaises(ValueError):m.reconcile(p,mapping)
 def test_missing_donor_authority_fails_closed(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp)/'synthetic.xlsx';mapping=self.fixture(p);del mapping['Fanuc']['verified_donor_label']
   with self.assertRaises(ValueError):m.reconcile(p,mapping)
 def test_normalization_does_not_correct_spelling(self):
  self.assertEqual(m.normalized('  Synthetic\tVillage '),'Synthetic Village');self.assertNotEqual(m.normalized('Village'),m.normalized('Vil lage'))
if __name__=='__main__':unittest.main()
