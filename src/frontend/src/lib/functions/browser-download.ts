/** Trigger a browser download via a temporary <a> element */
export const autoDownload = (url: string, filename: string) => {
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
};
