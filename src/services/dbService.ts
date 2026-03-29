import { supabase } from '../supabase';

export class DBService {
  async list<T>(table: string, uid: string): Promise<T[]> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('uid', uid);
    
    if (error) throw error;
    return data as T[];
  }

  async get<T>(table: string, id: string): Promise<T | null> {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as T;
  }

  async create<T>(table: string, data: any): Promise<T> {
    const { data: created, error } = await supabase
      .from(table)
      .insert([data])
      .select()
      .single();
    
    if (error) throw error;
    return created as T;
  }

  async update<T>(table: string, id: string, data: any): Promise<T> {
    const { data: updated, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return updated as T;
  }

  async delete(table: string, id: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  subscribe<T>(table: string, uid: string, callback: (data: T[]) => void) {
    // Fetch initial data
    this.list<T>(table, uid).then(callback).catch(console.error);

    const channel = supabase
      .channel(`public:${table}:uid=eq.${uid}`)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table, filter: `uid=eq.${uid}` }, 
        async () => {
          const data = await this.list<T>(table, uid);
          callback(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const dbService = new DBService();
