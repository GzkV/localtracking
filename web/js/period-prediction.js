export { predict, cycleLengths, median, absoluteErrors, };

function cycleLengths(cycles) {
	return cycles.slice().sort((a,b) => a.start.localeCompare(b.start)).slice(1).map((cycle,index,sorted) => {
		return Math.round((Date.parse(cycle.start) - Date.parse(sorted[index].start)) / 86400000);
	}).filter(length => Number.isFinite(length) && length > 0 && length < 500);
}

function median(values) {
	if (!values.length) return undefined;
	let sorted = values.slice().sort((a,b) => a - b);
	let middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function absoluteErrors(actual, predicted) {
	return actual.reduce((errors,value,index) => {
		if (Number.isFinite(predicted[index])) errors.push(Math.abs(value - predicted[index]));
		return errors;
	},[]);
}

function predict(cycles) {
	let lengths = cycleLengths(cycles.filter(cycle => !cycle.exceptional));
	if (!lengths.length) return { available: false, lengths, };
	let sorted = lengths.slice().sort((a,b) => a - b);
	let trim = sorted.length >= 5 ? Math.floor(sorted.length * 0.1) : 0;
	let usable = sorted.slice(trim,sorted.length - trim || undefined);
	let typical = median(usable);
	let deviations = usable.map(value => Math.abs(value - typical));
	let spread = median(deviations) || 1;
	let error = median(absoluteErrors(usable,usable.map(() => typical))) || 1;
	let range = Math.max(2,Math.ceil(Math.max(spread * 1.5,error)));
	let confidence = lengths.length < 3 ? "low" : lengths.length < 6 ? "moderate" : "higher";
	let last = cycles.slice().sort((a,b) => a.start.localeCompare(b.start)).pop();
	let date = new Date(Date.parse(last.start) + typical * 86400000);
	return { available: true, lengths, typical: Math.round(typical), min: Math.round(typical - range), max: Math.round(typical + range), confidence, date: date.toISOString().slice(0,10), error: Math.round(error), };
}
