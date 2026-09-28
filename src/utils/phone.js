export function toWaLink(rawPhone, message) {
	if (!rawPhone) return null;

	let digits = String(rawPhone).replace(/\D/g, '');
	if (digits.startsWith('0')) digits = '62' + digits.slice(1);
	else if (!digits.startsWith('62')) digits = '62' + digits;

	return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
