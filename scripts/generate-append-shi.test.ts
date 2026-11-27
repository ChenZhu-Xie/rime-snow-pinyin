import { expect, test } from "bun:test";
import { generateRoutes, pairCode } from "./generate-append-shi";

test("四拼完整、前缀及补 o 编码都保留正确读音约束", () => {
	const result = generateRoutes("snow_sipin", "sipin_algebra", [
		"mu3",
		"bu4",
		"bi4",
	]);
	expect(result).toContain("m\tmvia\tmu3");
	expect(result).toContain("mu\tmuvia\tmu3");
	expect(result).toContain("muuo\tmuuvia\tmu3");
	expect(result).not.toContain("mueaa\t");
});

test("调辅双拼查标准四主码，不把单字调码塞进词码中间", () => {
	expect(pairCode("snow_lanpin", "bha", "kfa")).toBe("bhkf");
	expect(pairCode("snow_sanpin", "bja", "sfa")).toBe("bjsf");
});
