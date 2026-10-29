import importlib.util
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
import openpyxl

spec = importlib.util.spec_from_file_location('officer_sources', Path(__file__).resolve().parents[2]/'scripts/audits/officer_sources.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class OfficerSourceTests(unittest.TestCase):
    def test_examples_formulas_and_missing_dates_are_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'synthetic.xlsx'
            w = openpyxl.Workbook(); s = w.active; s.title = 'Synthetic - Visit Log'
            s.append(['Synthetic title'])
            for _ in range(4): s.append([])
            s.append(['Visit Date','Center Name','Shift','Remarks','Month (auto)'])
            s.append([datetime(2026,7,8),'e.g. Synthetic example','Morning','Example only'])
            s.append([None,'Synthetic centre','Morning','Synthetic private feedback'])
            s.append([None,'Synthetic centre','Evening','Synthetic private feedback'])
            s.append([None,None,None,None,'=MONTH(A10)'])
            summary=w.create_sheet('Synthetic - Monthly Summary');summary.append(['=COUNT(A1:A2)'])
            w.save(path);w.close()
            result=module.inspect(path);log=result['sheets'][0]
            self.assertEqual(log['source_row_numbers'],[8,9]); self.assertEqual(log['example_rows_excluded'],[7])
            self.assertEqual(result['totals']['candidate_rows'],2); self.assertEqual(result['totals']['dated_candidate_rows'],0)
            self.assertEqual(result['totals']['verified_importable_events'],0)
            self.assertNotIn('Synthetic private feedback',str(result));self.assertNotIn('Synthetic centre',str(result))
            self.assertEqual(result['sheets'][1]['formula_cells'],1)

if __name__=='__main__': unittest.main()
