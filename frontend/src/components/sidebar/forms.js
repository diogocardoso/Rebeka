import { createNode } from './create.js';
import { rename } from './edit.js';

const titles = { folder: 'Coleção', request: 'Request' };

export function RenameForm(node) {
    const Form = new WA.Formulary();

    const View = {
        app() {
            Form.item.text('name', {
                label: '*Nome:',
                attr: { class: 'wa-form', value: node.name },
            });

            Form.submit({ text: 'Salvar', color: 'orange-5' });

            Form.action(async (data) => {
                const name = data.values.name?.trim();
                if (!name) return;

                await rename(node.id, name);
                WA.box_closed('boxFormSidebar');
            });

            return Form.show();
        },
    };

    this.show = () => {
        APP.box('boxFormSidebar', {
            title: `Renomear ${titles[node.type] || 'Item'}`,
            width: '400px',
            content: View.app(),
        });
    };
}

export function RequestForm(Colletion){
    const Form = new WA.Formulary();

    const View = {
        app(){
            Form.item.text('name', { label: '*Nome:', attr: { class: 'wa-form' } });

            Form.submit({ text: 'Salvar', color: 'orange-5' });

            Form.action(async (data) => {
                const name = data.values.name?.trim();
                if (!name) return;

                await createNode('request', name, {
                    parentId: Colletion.id,
                    workspaceId: Colletion.workspaceId,
                });

                WA.box_closed('boxFormSidebar');
            });

            return Form.show();
        }
    };

    this.show = () => {
        APP.box('boxFormSidebar', {
            title:'Request',
            width: '400px',
            content: View.app(),
        });
    };
};