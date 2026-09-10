
export interface OsintResult {
    module: string;
    risk: 'Low' | 'Medium' | 'High' | 'Unknown' | string;
    data: Record<string, any>;
}

export interface OsintModuleProps {
    moduleName: string;
    target: string;
}
