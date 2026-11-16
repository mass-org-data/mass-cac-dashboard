import {escapeHtml} from './html.js';

// Entry rosters scroll as one unit. Only saved-record lists are paginated.
// Row cells are rendered by the caller, which escapes record values.
export function rosterTable(headers, rows, className = '') {
 return `<div class="table-scroll ${escapeHtml(className)}"><table data-paginate="false"><thead><tr>${headers.map(label=>`<th>${escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
