export function sum(numbers) {
  return numbers.reduce((total, value) => total + value, 0);
}

export function average(numbers) {
  return sum(numbers) / numbers.length;
}

export function divide(a, b) {
  return a / b;
}
