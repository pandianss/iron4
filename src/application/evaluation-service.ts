import { SimulationResult } from "../engine/simulation"

export interface EvaluationService {
    evaluate(result: SimulationResult): unknown
}
