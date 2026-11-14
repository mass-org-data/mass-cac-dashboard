const pages = {overview:1, attendance:2, daily:2, children:3, learning:4, activities:5, visits:6, morarji:7, donor:8, guidance:9};
export const pageNumber = page => pages[page] || 1;
export const titleCase = title => String(title).replace(/\b[a-z]/g, value => value.toUpperCase());

// Visible display numbers are separate from the approved internal metric IDs.
export function applyContentNumbers(root, page) {
 const prefix = pageNumber(page);
 const heading = root.querySelector('.page-head h1');
 if (heading) heading.textContent=titleCase(heading.textContent);
 if (heading) heading.prepend(reference(`${prefix}.`));
 let index = 0;
 for (const element of root.querySelectorAll('.content .metric-top, .content .card h2')) {
  if (element.matches('h2')) element.textContent = titleCase(element.textContent);
  element.prepend(reference(`${prefix}.${++index}`));
 }
}

function reference(value) {
 const span = document.createElement('span');
 span.className = 'content-reference';
 span.setAttribute('aria-hidden', 'true');
 span.textContent = value + ' ';
 return span;
}
